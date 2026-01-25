<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import Matter from 'matter-js'
import { useDebtStore } from '../stores/debtStore'
import { useGameJuice } from '../composables/useGameJuice'

const store = useDebtStore()
const { playSfx, triggerConfetti } = useGameJuice()
const container = ref<HTMLElement | null>(null)

const props = defineProps<{
    targetingMode: boolean,
    paymentAmount: number
}>()

const emit = defineEmits<{
    (e: 'target-confirmed', blockId: string): void
    (e: 'cancel-targeting'): void
}>()

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
const warningMsg = ref('')
let warningTimeout: number | null = null

function showWarning(msg: string) {
    warningMsg.value = msg
    playSfx('crumble') // Error sound
    triggerShake()
    
    if (warningTimeout) clearTimeout(warningTimeout)
    warningTimeout = setTimeout(() => {
        warningMsg.value = ''
    }, 2000)
}

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

    // Toggle God Mode vs Laser Mode
    watch(() => props.targetingMode, (val) => {
        if (mouseConstraint?.constraint) {
            // Disable dragging when targeting
            mouseConstraint.constraint.stiffness = val ? 0 : 0.2
        }
        if (val) {
             container.value?.style.setProperty('cursor', 'none')
        } else {
             container.value?.style.setProperty('cursor', 'default')
        }
    })

    // 5. Watch for store changes
    watch(() => store.towerBlocks, () => {
        syncBodies()
    }, { deep: true })

    // 6. Targeting Visuals & Logic
    const mousePosition = { x: 0, y: 0 }
    
    // Track mouse for Laser Line
    render.canvas.addEventListener('mousemove', (e) => {
        if (props.targetingMode) {
            const rect = render.canvas.getBoundingClientRect()
            mousePosition.x = (e.clientX - rect.left) * (render.canvas.width / rect.width)
            mousePosition.y = (e.clientY - rect.top) * (render.canvas.height / rect.height)
        }
    })

    // Click to Shoot
    render.canvas.addEventListener('mousedown', () => {
        if (!props.targetingMode) return
        
        // Find body under cursor
        const bodies = Matter.Composite.allBodies(engine.world)
        const hit = Matter.Query.point(bodies, mousePosition)
        
        // Filter out walls/static
        const target = hit.find(b => !b.isStatic && (b as any).plugin?.blockId)
        
        if (target) {
            const blockId = (target as any).plugin.blockId
            
            // Check value constraint
            // We need to look up the actual block data from the store or body plugin if it has current value
            // The body plugin only has ID and color. We need to find the block in the store.
            const block = store.towerBlocks.find(b => b.id === blockId)
            
            if (block) {
                if (props.paymentAmount > block.current) {
                     showWarning('Laser power exceeds block value!')
                     return
                }
                emit('target-confirmed', blockId)
            }
        } else {
            // Missed? Maybe cancel?
            // emit('cancel-targeting')
        }
    })

    Matter.Events.on(render, 'afterRender', () => {
        if (!props.targetingMode) return

        const ctx = render.context
        
        // Draw Crosshair
        ctx.strokeStyle = '#06b6d4' // Cyan
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(mousePosition.x, mousePosition.y, 20, 0, 2 * Math.PI)
        ctx.stroke()
        
        // Draw Cross lines
        ctx.beginPath()
        ctx.moveTo(mousePosition.x - 25, mousePosition.y)
        ctx.lineTo(mousePosition.x + 25, mousePosition.y)
        ctx.moveTo(mousePosition.x, mousePosition.y - 25)
        ctx.lineTo(mousePosition.x, mousePosition.y + 25)
        ctx.stroke()
        
        // Draw Laser Line from bottom center (or top?)
        const startX = render.canvas.width / 2
        const startY = render.canvas.height
        
        ctx.beginPath()
        ctx.moveTo(startX, startY)
        ctx.lineTo(mousePosition.x, mousePosition.y)
        ctx.strokeStyle = 'rgba(6, 182, 212, 0.4)'
        ctx.lineWidth = 4
        ctx.setLineDash([10, 10]) // Dashed laser guide
        ctx.stroke()
        ctx.setLineDash([]) // Reset
    })

    // 7. Resize Observer
    resizeObserver = new ResizeObserver(() => {
        handleResize()
    })
    resizeObserver.observe(container.value)

    // 8. ESC to Cancel
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && props.targetingMode) {
            emit('cancel-targeting')
        }
    })

    // 7. Victory Watcher
    watch(() => store.totalBlocks, (newVal, oldVal) => {
        if (newVal === 0 && oldVal > 0 && store.totalPaid > 0) {
            playSfx('victory')
            triggerConfetti()
        }
    })
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
            playSfx('crumble') // <--- Sound Effect

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

const isChaosCooldown = ref(false)

function triggerChaos() {
    if (isChaosCooldown.value) return
    
    isChaosCooldown.value = true
    isShaking.value = true
    playSfx('attack') // Chaos sound
    setTimeout(() => isShaking.value = false, 500)
    
    // Cooldown reset
    setTimeout(() => {
        isChaosCooldown.value = false
    }, 2000)

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
                    :disabled="isChaosCooldown"
                    class="bg-red-500/20 hover:bg-red-500/80 text-white p-2 rounded-full backdrop-blur-sm transition-all shadow-lg border border-red-500/50 hover:scale-110 active:scale-95 group/smash disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed disabled:hover:scale-100"
                    title="SMASH!"
                >
                    <i class="pi pi-bolt text-xl animate-pulse group-hover/smash:animate-none" :class="{'!animate-none text-slate-400': isChaosCooldown}"></i>
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

            <!-- Targeting Overlay -->
            <div v-if="targetingMode" class="absolute top-4 left-4 z-40 pointer-events-auto">
                <div class="flex items-center gap-3 bg-slate-900/80 backdrop-blur rounded-xl p-3 border border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.3)]">
                     <i class="pi pi-bolt text-cyan-400 animate-pulse text-2xl"></i>
                     <div>
                         <p class="text-cyan-400 font-black uppercase text-xs tracking-widest">Targeting Active</p>
                         <p class="text-white font-mono text-sm leading-none mt-1">Select Block to Destroy (£{{ paymentAmount }})</p>
                         <p class="text-[10px] text-slate-400 mt-1 font-mono">Press <span class="text-white font-bold">ESC</span> to cancel</p>
                     </div>
                     <button @click="emit('cancel-targeting')" class="ml-2 hover:bg-white/10 p-2 rounded-full transition-colors text-white">
                         <i class="pi pi-times"></i>
                     </button>
                </div>
            </div>

            <!-- Warning Overlay -->
            <div v-if="warningMsg" class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none">
                 <div class="bg-red-500/90 text-white px-6 py-4 rounded-xl shadow-2xl backdrop-blur-md animate-shake flex flex-col items-center">
                      <i class="pi pi-exclamation-triangle text-4xl mb-2"></i>
                      <h3 class="font-black uppercase tracking-widest text-lg">Target Invalid</h3>
                      <p class="font-mono text-sm">{{ warningMsg }}</p>
                 </div>
            </div>

            <!-- Victory Overlay -->
            <div v-if="store.totalBlocks === 0 && store.totalPaid > 0" class="absolute inset-0 flex flex-col items-center justify-center z-20 pointer-events-auto bg-black/40 backdrop-blur-md transition-all duration-1000">
                 <h2 class="text-6xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-orange-400 to-yellow-300 mb-4 animate-bounce drop-shadow-[0_0_25px_rgba(234,179,8,0.6)]">
                    DEBT FREE!
                </h2>
                <p class="text-white text-xl font-bold tracking-widest uppercase animate-pulse mb-8">Mission Accomplished</p>
                
                <button 
                    @click="store.resetProgress(); playSfx('charge')"
                    class="group relative px-8 py-3 bg-white/10 overflow-hidden rounded-full font-black uppercase tracking-widest transition-all hover:bg-white/20 hover:scale-105 active:scale-95 border border-white/50"
                >
                    <div class="absolute inset-0 w-0 bg-gradient-to-r from-transparent via-white/40 to-transparent group-hover:w-full transition-[width] duration-500 skew-x-12"></div>
                    <span class="flex items-center gap-2 drop-shadow-md">
                        <i class="pi pi-replay"></i> Play Again
                    </span>
                </button>
            </div>
        </div>

        <!-- Legend Below -->
        <div class="glass-card rounded-xl p-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 shadow-sm">
             <div v-for="debt in store.debts" :key="debt.id" class="flex items-center gap-2 bg-slate-800/40 px-2.5 py-1 rounded-full border border-slate-700/50">
                 <div class="w-2.5 h-2.5 rounded-full shadow-[0_0_8px_rgba(255,255,255,0.3)]" :style="{ backgroundColor: debt.color }"></div>
                 <span class="text-xs text-slate-300 font-bold tracking-wide">{{ debt.name }}</span>
             </div>
             
             <!-- Interest Legend -->
             <div v-if="store.debts.some(d => d.blocks.some(b => b.type === 'interest' && b.current > 0))" class="flex items-center gap-2 bg-red-900/20 px-2.5 py-1 rounded-full border border-red-500/20">
                  <div class="w-2.5 h-2.5 rounded-full shadow-[0_0_8px_rgba(220,38,38,0.5)] bg-red-600"></div>
                  <span class="text-xs text-red-200 font-bold tracking-wide">Interest</span>
             </div>
        </div>
    </div>
</template>
