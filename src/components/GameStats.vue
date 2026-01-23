<script setup lang="ts">
import { useDebtStore } from '../stores/debtStore'
import { computed } from 'vue'

const store = useDebtStore()

const xpPerLevel = 1000

const level = computed(() => {
    return Math.floor(store.xp / xpPerLevel) + 1
})

const xpProgress = computed(() => {
    const currentLevelXp = store.xp % xpPerLevel
    return (currentLevelXp / xpPerLevel) * 100
})

const xpToNextLevel = computed(() => {
    return xpPerLevel - (store.xp % xpPerLevel)
})
</script>

<template>
    <div class="grid grid-cols-1 gap-4">
        <div class="glass-card rounded-2xl p-6 relative overflow-hidden group">
            <!-- Background Glow -->
            <div class="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl group-hover:bg-indigo-500/20 transition-all duration-700"></div>
            
            <div class="relative z-10 flex flex-col gap-3">
                <div class="flex justify-between items-end">
                    <div>
                         <p class="text-indigo-300 text-[10px] font-black uppercase tracking-[0.2em] mb-1">Current Rank</p>
                         <h2 class="text-3xl font-black text-white leading-none">LEVEL {{ level }}</h2>
                    </div>
                    <div class="text-right">
                        <p class="text-2xl font-black text-indigo-400 drop-shadow-[0_0_10px_rgba(129,140,248,0.5)]">{{ store.xp.toLocaleString() }} <span class="text-sm text-slate-400 font-bold">XP</span></p>
                    </div>
                </div>

                <!-- XP Progress Bar -->
                <div class="space-y-1">
                    <div class="flex justify-between text-[10px] font-mono text-slate-500 uppercase">
                        <span>Progress</span>
                        <span>{{ Math.round(xpProgress) }}%</span>
                    </div>
                    <div class="w-full bg-slate-800/50 h-2 rounded-full overflow-hidden border border-white/5">
                        <div class="h-full bg-gradient-to-r from-indigo-500 to-purple-500 shadow-[0_0_12px_rgba(168,85,247,0.6)] transition-all duration-1000 ease-out relative" :style="{ width: xpProgress + '%' }">
                            <div class="absolute right-0 top-0 bottom-0 w-1 bg-white/50 animate-pulse"></div>
                        </div>
                    </div>
                    <p class="text-right text-[10px] text-slate-500 italic">{{ xpToNextLevel }} XP to next Level</p>
                </div>
            </div>
        </div>
    </div>
</template>
