<script setup lang="ts">
import { useDebtStore } from '../stores/debtStore'
import { computed } from 'vue'

const store = useDebtStore()

const percentPaid = computed(() => {
    if (store.totalBlocks === 0) return 0
    return Math.round((store.destroyedBlocks / store.totalBlocks) * 100)
})

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
        <div class="bg-gradient-to-br from-indigo-900 to-purple-900 p-4 rounded-xl shadow-lg border border-indigo-500/30 flex flex-col justify-between">
            <div>
                <div class="flex justify-between items-baseline mb-1">
                    <p class="text-indigo-300 text-xs font-bold uppercase tracking-wider">Level {{ level }}</p>
                    <p class="text-indigo-400 text-[10px]">{{ xpToNextLevel }} XP to up</p>
                </div>
                <p class="text-3xl font-black text-white mb-2">{{ store.xp.toLocaleString() }} <span class="text-sm font-normal text-indigo-400">XP</span></p>
            </div>
            
            <!-- XP Progress Bar -->
            <div class="w-full bg-black/30 h-1.5 rounded-full overflow-hidden">
                <div class="h-full bg-indigo-400 shadow-[0_0_10px_rgba(129,140,248,0.6)] transition-all duration-1000 ease-out" :style="{ width: xpProgress + '%' }"></div>
            </div>
        </div>
    </div>
</template>
