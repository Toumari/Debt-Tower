<script setup lang="ts">
import PhysicsTower from './components/PhysicsTower.vue'
import DebtControl from './components/DebtControl.vue'
import GameStats from './components/GameStats.vue'
import Panel from 'primevue/panel';
</script>

<template>
  <main class="min-h-screen bg-[#0f172a] text-slate-100 font-sans selection:bg-purple-500 selection:text-white overflow-x-hidden">
    <div class="container mx-auto px-4 py-8 max-w-7xl">
      
      <!-- Header -->
      <header class="mb-8 text-center relative z-10">
        <h1 class="text-4xl md:text-6xl font-black tracking-tight mb-2 bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent drop-shadow-lg">
          DEBT TOWER
        </h1>
        <p class="text-slate-400 text-lg">Gamified Debt Destruction</p>
      </header>

      <!-- Mission Briefing (Instructions) -->
      <section class="max-w-4xl mx-auto mb-10">
        <Panel toggleable collapsed class="border-slate-700 bg-slate-800/50">
            <template #header>
                <div class="flex items-center gap-2 text-yellow-400 font-bold tracking-wide uppercase">
                    <i class="pi pi-info-circle text-xl"></i>
                    Mission Briefing
                </div>
            </template>
            <div class="prose prose-invert prose-sm max-w-none text-slate-300">
                <p class="mb-2">Your mission is simple: <strong>Destroy the Tower.</strong></p>
                <ul class="list-disc pl-5 space-y-1">
                    <li>Each full block represents <strong>£100</strong> of debt.</li>
                    <li>Add your debts (Loans, Cards) to build the tower.</li>
                    <li>Use the <strong>Attack Console</strong> to make payments.</li>
                    <li><strong>Partial Attacks</strong> shrink blocks until they vanish!</li>
                    <li>Watch the physics engine crumble your debt pile.</li>
                </ul>
            </div>
        </Panel>
      </section>

      <!-- Game Board Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        <!-- Main Stage (The Tower) - Left/Center on Desktop -->
        <div class="lg:col-span-7 xl:col-span-8 order-1">
           <div class="sticky top-8 space-y-6">
              <GameStats />
              <PhysicsTower />
           </div>
        </div>

        <!-- Right Col: Controls & Stats -->
        <div class="lg:col-span-5 xl:col-span-4 space-y-6 order-2">
          <DebtControl />
        </div>

      </div>
      
      <footer class="mt-20 text-center text-slate-600 text-sm py-4">
        <p>ROI Project #5 - Gamified Fintech</p>
      </footer>
    </div>
  </main>
</template>

<style>
/* Global resets or overrides if needed */
body {
  background-color: #0f172a; 
}

/* Panel Overrides for Dark Theme */
.p-panel .p-panel-header {
    background: rgba(30, 41, 59, 0.5) !important;
    border-color: rgba(51, 65, 85, 0.5) !important;
    color: #f8fafc !important;
}
.p-panel .p-panel-content {
    background: rgba(15, 23, 42, 0.5) !important;
    border-color: rgba(51, 65, 85, 0.5) !important;
    color: #e2e8f0 !important;
}
</style>
