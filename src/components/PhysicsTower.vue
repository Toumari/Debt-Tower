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
let resizeObserver: ResizeObserver | null = null

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
    const height = container.value.clientHeight

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

    // Custom Rendering
    Matter.Events.on(render, 'afterRender', () => {
        const ctx = render.context
        
        store.towerBlocks.forEach(block => {
            const body = bodyMap.get(block.id)
            if (!body) return
            

            const { x, y } = body.position
            const angle = body.angle
            
            ctx.translate(x, y)
            ctx.rotate(angle)
            
            // Draw Block (Rounded)
            ctx.beginPath()
            roundRect(ctx, -BLOCK_WIDTH/2, -BLOCK_HEIGHT/2, BLOCK_WIDTH, BLOCK_HEIGHT, 4)
            ctx.fillStyle = block.color
            ctx.fill()
            
            // Inner Shine/Glow attempt
            ctx.strokeStyle = 'rgba(255,255,255,0.2)'
            ctx.lineWidth = 1
            ctx.stroke()
            
            // Draw Text
            ctx.fillStyle = 'rgba(255,255,255,0.9)' 
            ctx.font = 'bold 11px system-ui'
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
    createBoundaries(width, height)

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
    watch(() => store.towerBlocks, () => {
        syncBodies()
    }, { deep: true })

    // 6. Resize Observer
    resizeObserver = new ResizeObserver(() => {
        handleResize()
    })
    resizeObserver.observe(container.value)
})

onUnmounted(() => {
    if (render) {
        Matter.Render.stop(render)
        if (render.canvas) render.canvas.remove()
    }
    if (runner) Matter.Runner.stop(runner)
    if (engine) Matter.Engine.clear(engine)
    if (resizeObserver) resizeObserver.disconnect()
})

// Helper for rounded rect canvas
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

let walls: Matter.Body[] = []

function createBoundaries(w: number, h: number) {
    // Remove old boundaries
    if (walls.length > 0) {
        Matter.World.remove(world, walls)
    }

    const wallOptions = { 
        isStatic: true, 
        render: { fillStyle: 'transparent', opacity: 0 },
        friction: 0.0
    }
    
    // Floor (invisible, slightly below view)
    const floor = Matter.Bodies.rectangle(w / 2, h + 25, w, 50, wallOptions)
    
    // Walls (Invisible-ish but keep blocks in)
    const leftWall = Matter.Bodies.rectangle(-25, h / 2, 50, h * 2, wallOptions)
    const rightWall = Matter.Bodies.rectangle(w + 25, h / 2, 50, h * 2, wallOptions)

    walls = [floor, leftWall, rightWall]
    Matter.World.add(world, walls)
}

function handleResize() {
    if (!container.value || !render) return
    const w = container.value.clientWidth
    const h = container.value.clientHeight

    render.canvas.width = w
    render.canvas.height = h
    render.options.width = w
    render.options.height = h
    
    createBoundaries(w, h)
    restack() // Optional: Re-organize whenever resized? Maybe just let them fall? 
             // Restack is cleaner for wide -> narrow transitions so they don't explode.
}

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
            // No action needed really, render loop handles visual.
        } else {
            // New Body - Spawn at top
            const spawnX = centerX + (Math.random() - 0.5) * 50
            const spawnY = -100 - (index * 5) 
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
        chamfer: { radius: 2 }, 
        render: {
            opacity: 0,
            fillStyle: 'transparent'
        },
        restitution: 0.1, 
        friction: 0.9,  
        density: 0.005,
        slop: 0.01 
    })
    ;(body as any).plugin = { blockId: block.id, color: block.color }
    return body
}

function spawnDebris(x: number, y: number, color: string) {
    const debrisCount = 4 + Math.floor(Math.random() * 4) 
    for (let i = 0; i < debrisCount; i++) {
        const size = 5 + Math.random() * 8
        const debris = Matter.Bodies.rectangle(x, y, size, size, {
            render: {
                fillStyle: color
            },
            friction: 0.5,
            restitution: 0.5,
            density: 0.001 
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
    const height = container.value.clientHeight
    
    // Staggered Brick Wall Logic (Running Bond)
    const gap = 1
    const effWidth = BLOCK_WIDTH + gap
    
    // Calculate cols based on width
    const availableWidth = width - 40 
    const cols = Math.floor(availableWidth / effWidth)
    const MAX_COLS = 12
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
            const newY = height - (row * (BLOCK_HEIGHT + 1)) - (h / 2) - 10 // -10 Padding from bottom
            
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
    
    Matter.Composite.allBodies(world).forEach(body => {
        if (!body.isStatic) {
            Matter.Body.applyForce(body, body.position, {
                x: (Math.random() - 0.5) * 0.2,
                y: -0.05 - Math.random() * 0.1 
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
        <!-- Tower Container with Glassmorphism and Responsive Height -->
        <div ref="container" :class="{ 'animate-shake': isShaking }" class="tower-container glass-panel rounded-2xl w-full h-[50vh] md:h-[600px] relative overflow-hidden group transition-all duration-300">
            
            <!-- Controls overlay -->
            <div class="absolute top-4 right-4 flex flex-col items-end gap-2 z-30 pointer-events-auto">
                <!-- Smash Button -->
                <button 
                    @click="triggerChaos"
                    class="bg-red-500/20 hover:bg-red-500/80 text-white p-2 rounded-full backdrop-blur-sm transition-all shadow-lg border border-red-500/50 hover:scale-110 active:scale-95 group/smash"
                    title="SMASH!"
                >
                    <i class="pi pi-bolt text-xl animate-pulse group-hover/smash:animate-none"></i>
                </button>

                <!-- Restack Button -->
                <button 
                    @click="restack"
                    class="bg-slate-700/30 hover:bg-slate-600/80 text-slate-300 p-2 rounded-full backdrop-blur-sm transition-all shadow-lg border border-slate-600/50 hover:scale-110 active:scale-95"
                    title="Tidy Tower"
                >
                    <i class="pi pi-align-justify text-xl"></i>
                </button>
                <div class="text-xs text-slate-400 font-mono text-right pointer-events-none mt-2 glass-card px-2 py-1 rounded">
                     <p>{{ store.totalBlocks }} Blocks</p>
                     <p>Physics Active</p>
                </div>
            </div>

            <!-- Victory Overlay -->
            <div v-if="store.totalBlocks === 0 && store.totalPaid > 0" class="absolute inset-0 flex flex-col items-center justify-center z-20 pointer-events-none bg-black/20 backdrop-blur-sm">
                 <h2 class="text-6xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-orange-400 to-yellow-300 mb-4 animate-bounce drop-shadow-[0_0_25px_rgba(234,179,8,0.6)]">
                    DEBT FREE!
                </h2>
                <p class="text-white text-xl font-bold tracking-widest uppercase animate-pulse">Mission Accomplished</p>
            </div>
        </div>

        <!-- Legend Below -->
        <div class="glass-card rounded-xl p-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 shadow-sm">
             <div v-for="debt in store.debts" :key="debt.id" class="flex items-center gap-2 bg-slate-800/40 px-2.5 py-1 rounded-full border border-slate-700/50">
                 <div class="w-2.5 h-2.5 rounded-full shadow-[0_0_8px_rgba(255,255,255,0.3)]" :style="{ backgroundColor: debt.color }"></div>
                 <span class="text-xs text-slate-300 font-bold tracking-wide">{{ debt.name }}</span>
             </div>
             
             <!-- Interest Legend -->
             <div class="flex items-center gap-2 bg-red-900/20 px-2.5 py-1 rounded-full border border-red-500/20">
                  <div class="w-2.5 h-2.5 rounded-full shadow-[0_0_8px_rgba(220,38,38,0.5)] bg-red-600"></div>
                  <span class="text-xs text-red-200 font-bold tracking-wide">Interest</span>
             </div>
        </div>
    </div>
</template>
