<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import Matter from 'matter-js'
import { useDebtStore } from '../stores/debtStore'

const store = useDebtStore()
const container = ref<HTMLElement | null>(null)

// Physics Engine Refs
let engine: Matter.Engine
let render: Matter.Render
let runner: Matter.Runner

let world: Matter.World
let mouseConstraint: Matter.MouseConstraint

// Track bodies to sync with store
// Map blockId -> Body
const bodyMap = new Map<string, Matter.Body>()

// Config
const BLOCK_WIDTH = 50
const BLOCK_HEIGHT = 25

const isShaking = ref(false)

function triggerShake() {
    isShaking.value = true
    setTimeout(() => {
        isShaking.value = false
    }, 200)
}

onMounted(() => {
    if (!container.value) return

    // 1. Setup Matter.js
    engine = Matter.Engine.create()
    world = engine.world

    // Micro-blocks need HIGH precision to not clip through each other
    engine.positionIterations = 30
    engine.velocityIterations = 30
    engine.enableSleeping = false

    const width = container.value.clientWidth
    const height = 600

    render = Matter.Render.create({
        element: container.value,
        engine: engine,
        options: {
            width,
            height,
            wireframes: false, 
            background: 'transparent',
            pixelRatio: window.devicePixelRatio,
            showSleeping: false 
        }
    })

    // Custom Liquid Rendering
    Matter.Events.on(render, 'afterRender', () => {
        const ctx = render.context
        
        store.towerBlocks.forEach(block => {
            const body = bodyMap.get(block.id)
            if (!body) return
            

            const { x, y } = body.position
            const angle = body.angle
            
            ctx.translate(x, y)
            ctx.rotate(angle)
            
            // Draw Container (Glass)
            ctx.beginPath()
            ctx.rect(-BLOCK_WIDTH/2, -BLOCK_HEIGHT/2, BLOCK_WIDTH, BLOCK_HEIGHT)
            
            // Draw Full Block
            ctx.fillStyle = block.color
            ctx.fill()
            
            // Draw Text
            ctx.fillStyle = '#fff' 
            ctx.font = 'bold 10px sans-serif'
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            
            // Show rounded value or simple £
            const val = typeof block.current === 'number' ? Math.ceil(block.current) : 0
            if (!isNaN(val)) {
                 ctx.fillText(`£${val}`, 0, 0)
            }
            
            ctx.rotate(-angle)
            ctx.translate(-x, -y)
        })
    })


    // 2. Create Static Boundaries (Game Container)
    const wallOptions = { 
        isStatic: true, 
        render: { fillStyle: '#334155', opacity: 0.5 },
        friction: 0.0
    }
    
    // Floor
    const floor = Matter.Bodies.rectangle(width / 2, height + 25, width, 50, wallOptions)
    
    // Walls (Invisible-ish but keep blocks in)
    const leftWall = Matter.Bodies.rectangle(-25, height / 2, 50, height * 2, wallOptions)
    const rightWall = Matter.Bodies.rectangle(width + 25, height / 2, 50, height * 2, wallOptions)

    Matter.World.add(world, [floor, leftWall, rightWall])

    // 4. Mouse Interaction (God Mode)
    const mouse = Matter.Mouse.create(render.canvas)
    mouse.pixelRatio = window.devicePixelRatio // Fix offset on high DPI screens
    
    mouseConstraint = Matter.MouseConstraint.create(engine, {
        mouse: mouse,
        constraint: {
            stiffness: 0.2,
            render: {
                visible: false
            }
        }
    })
    Matter.World.add(world, mouseConstraint)
    render.mouse = mouse // Keep the mouse in sync with rendering

    // 5. Start Simulation
    runner = Matter.Runner.create()
    Matter.Runner.run(runner, engine)
    Matter.Render.run(render)

    // 6. Initial Sync & Restack
    syncBodies()
    setTimeout(restack, 100)

    // 5. Watch for store changes
    // Remove blocks when fully empty (ratio 0, filtered out of towerBlocks)
    watch(() => store.towerBlocks, () => {
        syncBodies()
    }, { deep: true })
})

onUnmounted(() => {
    if (render) {
        Matter.Render.stop(render)
        if (render.canvas) render.canvas.remove()
    }
    if (runner) Matter.Runner.stop(runner)
    if (engine) Matter.Engine.clear(engine)
})

function syncBodies() {
    if (!container.value) return
    const width = container.value.clientWidth
    const centerX = width / 2
    
    // 1. Identify active IDs from store
    const activeIds = new Set(store.towerBlocks.map(b => b.id))
    
    // 2. Remove bodies that are no longer in store
    for (const [id, body] of bodyMap.entries()) {
        if (!activeIds.has(id)) {
            // Block Destroyed!
            const { x, y } = body.position
            // Use stored color or get from render props if available? 
            // We need to look up the color from previous state or just guess?
            // Actually, we can get it from the body.render.fillStyle if we set it?
            // Wait, we didn't set fillStyle on the body render object, we drew it manually.
            // Let's assume a default debris color or try to find the block in previous store state?
            // Simpler: Just pass a generic "debris" color or random debt color.
            // Better: We still have the bodyMap entry, but we don't have the block data easily if it's already gone from store.
            // Hack: Store color on the body plugin object when creating.
            
            const color = (body as any).plugin.color || '#fff'
            spawnDebris(x, y, color)
            triggerShake()

            Matter.World.remove(world, body)
            bodyMap.delete(id)
        }
    }

    // 3. Add or Update bodies
    store.towerBlocks.forEach((block, index) => {
        if (bodyMap.has(block.id)) {
            // physics body stays constant size!
            // Just update color reference?
            // No action needed really, render loop handles visual.
        } else {
            // New Body - Spawn at top
            const spawnX = centerX + (Math.random() - 0.5) * 50
            const spawnY = -100 - (index * 5) // Faster spawn offset for small blocks 
            const body = createBlock(spawnX, spawnY, block)
            Matter.World.add(world, body)
            bodyMap.set(block.id, body)
        }
    })
}

function createBlock(x: number, y: number, block: any) {
    const w = BLOCK_WIDTH
    const h = BLOCK_HEIGHT
    
    const body = Matter.Bodies.rectangle(x, y, w, h, {
        chamfer: { radius: 1 }, // Smaller radius
        render: {
            opacity: 0,
            fillStyle: 'transparent'
        },
        restitution: 0.1, 
        friction: 0.9, // High friction for stable massive piles   
        density: 0.005,
        slop: 0.01 // Tighten slope for small objects
    })
    ;(body as any).plugin = { blockId: block.id, color: block.color }
    return body
}

function spawnDebris(x: number, y: number, color: string) {
    const debrisCount = 4 + Math.floor(Math.random() * 4) // 4-8 pieces
    for (let i = 0; i < debrisCount; i++) {
        const size = 5 + Math.random() * 8
        const debris = Matter.Bodies.rectangle(x, y, size, size, {
            render: {
                fillStyle: color
            },
            friction: 0.5,
            restitution: 0.5,
            density: 0.001 // Very light
        })
        
        // Explode outward
        const force = 0.005
        Matter.Body.applyForce(debris, debris.position, {
            x: (Math.random() - 0.5) * force,
            y: (Math.random() - 0.5) * force
        })
        
        Matter.World.add(world, debris)
        
        // Cleanup debris after 2s
        setTimeout(() => {
            Matter.World.remove(world, debris)
        }, 2000)
    }
}

function restack() {
    if (!container.value) return
    const width = container.value.clientWidth
    const baseHeight = 600
    
    // Staggered Brick Wall Logic (Running Bond)
    // Micro blocks: 20x10. Gap 1px.
    const gap = 1
    const effWidth = BLOCK_WIDTH + gap
    
    // Calculate cols based on width
    const availableWidth = width - 40 
    const cols = Math.floor(availableWidth / effWidth)
    const MAX_COLS = 10
    const safeCols = Math.max(1, Math.min(cols, MAX_COLS))
    
    // Center the wall
    const wallWidth = safeCols * effWidth
    const startX = (width - wallWidth) / 2 + (BLOCK_WIDTH / 2)
    
    store.towerBlocks.forEach((block, index) => {
        const body = bodyMap.get(block.id)
        if (body) {
            const h = BLOCK_HEIGHT 
            
            // Grid Position
            const row = Math.floor(index / safeCols)
            const col = index % safeCols
            
            // Staggered Offset for odd rows
            const isOddRow = row % 2 !== 0
            
            const newX = startX + (col * effWidth) + (isOddRow ? (BLOCK_WIDTH / 2) : 0)
            
            // Y Position (Bottom Up)
            const newY = baseHeight - (row * (BLOCK_HEIGHT + 1)) - (h / 2)
            
            // Teleport
            Matter.Body.setPosition(body, { x: newX, y: newY })
            Matter.Body.setAngle(body, 0)
            Matter.Body.setVelocity(body, { x: 0, y: 0 })
            Matter.Body.setAngularVelocity(body, 0)
            Matter.Sleeping.set(body, false)
        }
    })
}

function triggerChaos() {
    isShaking.value = true
    setTimeout(() => isShaking.value = false, 500)

    // Disable gravity briefly
    engine.world.gravity.y = -0.5 // Float up slightly
    
    // Iterate bodies and apply random force
    Matter.Composite.allBodies(world).forEach(body => {
        if (!body.isStatic) {
            Matter.Body.applyForce(body, body.position, {
                x: (Math.random() - 0.5) * 0.2,
                y: -0.05 - Math.random() * 0.1 // Kick up
            })
        }
    })

    setTimeout(() => {
        engine.world.gravity.y = 1 // Restore gravity
    }, 1500)
}
</script>

<template>
    <div class="flex flex-col gap-4">
        <div ref="container" :class="{ 'animate-shake': isShaking }" class="tower-container bg-slate-800/20 rounded-xl w-full min-h-[600px] relative border border-slate-700/50 backdrop-blur-sm overflow-hidden group">
            
            <!-- Controls overlay -->
            <div class="absolute top-4 right-4 flex flex-col items-end gap-2 z-30">
                <!-- Smash Button -->
                <button 
                    @click="triggerChaos"
                    class="bg-red-500/80 hover:bg-red-600/90 text-white p-2 rounded-full backdrop-blur-sm transition-all shadow-lg border border-red-400 hover:scale-110 active:scale-95 group/smash"
                    title="SMASH!"
                >
                    <i class="pi pi-bolt text-xl animate-pulse group-hover/smash:animate-none"></i>
                </button>

                <!-- Restack Button -->
                <button 
                    @click="restack"
                    class="bg-slate-700/50 hover:bg-slate-600 text-slate-300 p-2 rounded-full backdrop-blur-sm transition-all shadow-lg border border-slate-600 hover:scale-110 active:scale-95"
                    title="Tidy Tower"
                >
                    <i class="pi pi-align-justify text-xl"></i>
                </button>
                <div class="text-xs text-slate-500 font-mono text-right pointer-events-none">
                     <p>{{ store.totalBlocks }} Blocks</p>
                     <p>Liquid Physics</p>
                </div>
            </div>

            <!-- Victory Overlay -->
            <div v-if="store.totalBlocks === 0 && store.totalPaid > 0" class="absolute inset-0 flex flex-col items-center justify-center z-20 pointer-events-none">
                 <h2 class="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500 mb-4 animate-bounce drop-shadow-lg">
                    DEBT FREE!
                </h2>
            </div>
        </div>

        <!-- Legend Below -->
        <div class="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 shadow-sm">
             <div v-for="debt in store.debts" :key="debt.id" class="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-full border border-slate-700">
                 <div class="w-2.5 h-2.5 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.5)]" :style="{ backgroundColor: debt.color }"></div>
                 <span class="text-xs text-slate-300 font-bold tracking-wide">{{ debt.name }}</span>
             </div>
             
             <!-- Interest Legend -->
             <div class="flex items-center gap-2 bg-slate-900/80 px-3 py-1.5 rounded-full border border-red-900/30">
                  <div class="w-2.5 h-2.5 rounded-full shadow-[0_0_8px_rgba(127,29,29,0.5)] bg-[#7f1d1d]"></div>
                  <span class="text-xs text-red-200 font-bold tracking-wide">Interest</span>
             </div>
        </div>
    </div>
</template>
