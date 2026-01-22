<script setup lang="ts">
import { useDebtStore } from '../stores/debtStore'

const store = useDebtStore()
</script>

<template>
    <div class="tower-container bg-slate-800/20 rounded-xl p-8 min-h-[600px] flex flex-col justify-end items-center relative border border-slate-700/50 backdrop-blur-sm overflow-hidden">
        
        <!-- Victory State -->
        <div v-if="store.totalBlocks === 0 && store.totalPaid > 0" class="absolute inset-0 flex flex-col items-center justify-center z-20 bg-slate-900/80 backdrop-blur-sm rounded-xl">
            <h2 class="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500 mb-4 animate-bounce">
                DEBT FREE!
            </h2>
            <p class="text-slate-300 text-xl">The tower has fallen.</p>
        </div>

        <!-- Empty State -->
        <div v-if="store.totalBlocks === 0" class="absolute inset-0 flex items-center justify-center text-slate-600 pointer-events-none">
            <p>Add a debt to build the tower.</p>
        </div>

        <!-- The Tower -->
        <!-- flex-wrap-reverse makes it stack from bottom left to right, then up -->
        <!-- We want standard wrapping but stacked from bottom? -->
        <!-- Actually, if we use flex-col-reverse on the container, items stack from bottom up. -->
        <!-- But within a row, we want them left-to-right? -->
        <!-- Easiest: Flex row wrap-reverse. -->
        <div class="w-full max-w-lg flex flex-wrap-reverse gap-1 justify-center content-start transition-all duration-500" style="min-height: 200px">
            
            <transition-group name="tower-block">
                <div 
                    v-for="block in store.towerBlocks" 
                    :key="block.id"
                    class="block-unit w-8 h-8 md:w-10 md:h-10 rounded-sm relative group cursor-pointer hover:brightness-110"
                    :style="{ backgroundColor: block.color }"
                >
                    <!-- Tooltip -->
                    <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-black text-xs px-2 py-1 rounded whitespace-nowrap z-10 pointer-events-none">
                        £{{ store.BLOCK_VALUE }}
                    </div>
                </div>
            </transition-group>

        </div>
        
        <div class="mt-8 text-center text-slate-500 text-sm font-mono">
           {{ store.totalBlocks }} blocks standing
        </div>
        
        <!-- Floor -->
        <div class="w-full h-2 bg-slate-600 mt-2 rounded bg-opacity-30"></div>
    </div>
</template>

<style scoped>
.block-unit {
    box-shadow: 
        inset 0 0 0 1px rgba(0,0,0,0.1), 
        0 4px 6px rgba(0,0,0,0.2);
}

/* Vue Transitions for Block Removal (Gravity effect) */
.tower-block-enter-active,
.tower-block-leave-active {
  transition: all 0.5s ease;
}
.tower-block-enter-from,
.tower-block-leave-to {
  opacity: 0;
  transform: translateY(-20px) scale(0.5); /* Fly up/down */
}
/* Ensure the remaining items move smoothly */
.tower-block-move {
  transition: transform 0.5s ease;
}
</style>
