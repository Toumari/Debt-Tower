<script setup lang="ts">
import { ref } from 'vue'
import PhysicsTower from './components/PhysicsTower.vue'
import DebtControl from './components/DebtControl.vue'
import GameStats from './components/GameStats.vue'
import Panel from 'primevue/panel';
import { useGameJuice } from './composables/useGameJuice';
import { useDebtStore } from './stores/debtStore';

const { isShaking, playSfx, shake } = useGameJuice()
const store = useDebtStore()

const isTargeting = ref(false)
const pendingPayment = ref(0)

function enableTargeting(amount: number) {
    isTargeting.value = true
    pendingPayment.value = amount
}

function cancelTargeting() {
    isTargeting.value = false
    pendingPayment.value = 0
}

function handleTargetConfirmed(blockId: string) {
    if (pendingPayment.value > 0) {
        // Laser Shot
        playSfx('laser')
        shake(200)
        store.paySpecificBlock(blockId, pendingPayment.value)
        
        // Reset
        isTargeting.value = false
        pendingPayment.value = 0
    }
}
</script>

<template>
  <main :class="{ 'shake-effect': isShaking }" class="min-h-screen bg-aurora text-slate-100 font-sans selection:bg-purple-500 selection:text-white overflow-x-hidden antialiased">
    <div class="container mx-auto px-4 py-8 max-w-7xl relative z-10">
      
      <!-- Header -->
      <header class="mb-8 text-center relative z-10 animate-fade-in-down">
        <h1 class="text-5xl md:text-7xl font-black tracking-tight mb-2 bg-gradient-to-r from-purple-400 via-pink-400 to-amber-400 bg-clip-text text-transparent drop-shadow-[0_0_15px_rgba(168,85,247,0.5)]">
          DEBT TOWER
        </h1>
        <p class="text-indigo-200/80 text-lg md:text-xl font-light tracking-wide">Gamified Debt Destruction</p>
      </header>

      <!-- Mission Briefing (Instructions) -->
      <section class="max-w-4xl mx-auto mb-10">
        <Panel toggleable collapsed class="glass-panel rounded-2xl overflow-hidden !border-slate-700/30">
            <template #header>
                <div class="flex items-center gap-3 text-yellow-400 font-bold tracking-wide uppercase text-sm md:text-base">
                    <i class="pi pi-info-circle text-xl animate-pulse"></i>
                    Mission Briefing
                </div>
            </template>
            <div class="prose prose-invert prose-sm max-w-none text-slate-300 p-2">
                <p class="mb-2 text-lg">Your mission is simple: <strong class="text-white">Destroy the Tower.</strong></p>
                <ul class="list-none space-y-2 pl-0">
                    <li class="flex items-center gap-2"><i class="pi pi-check text-green-400"></i> Each full block represents <strong>£100</strong> of debt.</li>
                    <li class="flex items-center gap-2"><i class="pi pi-check text-green-400"></i> Add your debts (Loans, Cards) to build the tower.</li>
                    <li class="flex items-center gap-2"><i class="pi pi-check text-green-400"></i> Use the <strong class="text-red-400">Attack Console</strong> to make payments.</li>
                    <li class="flex items-center gap-2"><i class="pi pi-check text-green-400"></i> <strong class="text-indigo-400">Partial Attacks</strong> shrink blocks until they vanish!</li>
                </ul>
            </div>
        </Panel>
      </section>

      <!-- Game Board Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start relative">
        
        <!-- Main Stage (The Tower) - Left/Center on Desktop -->
        <!-- On Mobile: Order 2 (Below stats but above DebtControl? Actually standard flow is fine) -->
        <div class="lg:col-span-7 xl:col-span-8 flex flex-col gap-6">
           <GameStats />
           <PhysicsTower 
              :targeting-mode="isTargeting" 
              :payment-amount="pendingPayment"
              @target-confirmed="handleTargetConfirmed"
              @cancel-targeting="cancelTargeting"
           />
        </div>

        <!-- Right Col: Controls & Stats -->
        <!-- On Mobile: Order 1? Maybe user wants to see debt first? No, seeing TOWER is key. -->
        <div class="lg:col-span-5 xl:col-span-4 space-y-6">
          <DebtControl @enable-targeting="enableTargeting" />
        </div>

      </div>
      
      <footer class="mt-20 text-center text-slate-500/60 text-sm py-4">
        <p>ROI Project #5 - Gamified Fintech</p>
      </footer>
    </div>
  </main>
</template>

<style>
/* Global resets or overrides if needed */
body {
  background-color: #0f172a; 
  background-image: radial-gradient(at 0% 0%, hsla(253,16%,7%,1) 0, transparent 50%), 
                    radial-gradient(at 50% 0%, hsla(225,39%,30%,0.3) 0, transparent 50%), 
                    radial-gradient(at 100% 0%, hsla(339,49%,30%,0.3) 0, transparent 50%);
  margin: 0;
  min-height: 100vh;
}

/* Panel Overrides for Dark Theme with Glassmorphism */
.p-panel .p-panel-header {
    background: rgba(30, 41, 59, 0.3) !important;
    border: none !important;
    color: #f8fafc !important;
}
.p-panel .p-panel-content {
    background: transparent !important;
    border: none !important;
    color: #cbd5e1 !important;
}
.p-panel .p-toggleable-content {
    background: rgba(15, 23, 42, 0.3) !important;
}

@keyframes shake {
  0% { transform: translate(1px, 1px) rotate(0deg); }
  10% { transform: translate(-1px, -2px) rotate(-1deg); }
  20% { transform: translate(-3px, 0px) rotate(1deg); }
  30% { transform: translate(3px, 2px) rotate(0deg); }
  40% { transform: translate(1px, -1px) rotate(1deg); }
  50% { transform: translate(-1px, 2px) rotate(-1deg); }
  60% { transform: translate(-3px, 1px) rotate(0deg); }
  70% { transform: translate(3px, 1px) rotate(-1deg); }
  80% { transform: translate(-1px, -1px) rotate(1deg); }
  90% { transform: translate(1px, 2px) rotate(0deg); }
  100% { transform: translate(1px, -2px) rotate(-1deg); }
}

.shake-effect {
  animation: shake 0.5s;
  animation-iteration-count: infinite;
}
</style>
