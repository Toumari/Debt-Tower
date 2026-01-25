import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface Block {
    id: string
    debtId: string
    current: number
    max: number // Usually 100
    color: string
    type: 'principal' | 'interest'
}

export interface Debt {
    id: string
    name: string
    amount: number
    paid: number
    interestRate: number
    color: string
    blocks: Block[]
}

const COLORS = [
    '#3B82F6', // Blue (First is now Blue, safe from Red)
    '#10B981', // Emerald
    '#F59E0B', // Amber
    '#8B5CF6', // Purple
    '#EC4899', // Pink
    '#06B6D4', // Cyan
    '#F97316'  // Orange
]

export const useDebtStore = defineStore('debt', () => {
    const debts = ref<Debt[]>([])
    const totalPaidGame = ref(0)

    // Constants
    const BLOCK_VALUE = 100

    // Getters
    const totalDebt = computed(() => debts.value.reduce((sum: number, d: Debt) => sum + d.amount, 0))
    const totalPaid = computed(() => debts.value.reduce((sum: number, d: Debt) => sum + d.paid, 0))
    const remainingDebt = computed(() => totalDebt.value - totalPaid.value)

    // Tower Physics Blocks
    // Only return blocks that are NOT fully destroyed (current > 0)
    const towerBlocks = computed(() => {
        const activeBlocks: any[] = []

        debts.value.forEach((debt: Debt) => {
            debt.blocks.forEach((block: Block) => {
                if (block.current > 0) {
                    activeBlocks.push({
                        id: block.id,
                        debtId: block.debtId,
                        color: block.color,
                        current: block.current,
                        max: block.max,
                        // Ratio for liquid effect: current / max
                        ratio: block.current / block.max
                    })
                }
            })
        })

        return activeBlocks
    })

    const totalBlocks = computed(() => towerBlocks.value.length)
    const destroyedBlocks = computed(() => Math.floor(totalPaid.value / BLOCK_VALUE))
    const xp = computed(() => Math.floor(totalPaidGame.value))

    // Actions
    function addDebt(name: string, amount: number, interestRate: number) {
        const id = Date.now().toString(36) + Math.random().toString(36).substr(2)
        const colorIndex = debts.value.length % COLORS.length
        const color = COLORS[colorIndex] || '#ccc'

        // Generate Principal Blocks
        const blocks: Block[] = []
        let remaining = amount
        let blockCount = 0

        while (remaining > 0) {
            const blockSize = Math.min(remaining, BLOCK_VALUE)
            blocks.push({
                id: `${id}-${blockCount}`,
                debtId: id,
                current: blockSize,
                max: blockSize,
                color: color,
                type: 'principal'
            })
            remaining -= blockSize
            blockCount++
        }

        // Generate Interest Blocks (Annual Interest)
        const annualInterest = amount * (interestRate / 100)
        let remainingInterest = annualInterest
        const interestColor = '#7f1d1d' // Dark Red

        while (remainingInterest > 0) {
            const blockSize = Math.min(remainingInterest, BLOCK_VALUE)
            blocks.push({
                id: `${id}-int-${blockCount}`,
                debtId: id,
                current: blockSize,
                max: blockSize,
                color: interestColor,
                type: 'interest'
            })
            remainingInterest -= blockSize
            blockCount++
        }

        debts.value.push({
            id,
            name,
            amount,
            paid: 0,
            interestRate,
            color,
            blocks
        })
        saveState()
    }

    // Payment Logic - Strategies
    function makePayment(amount: number, targetDebtId?: string, strategy: 'standard' | 'random' | 'targeted' = 'standard', targetBlockId?: string, specificBlockIds?: string[]) {
        if (remainingDebt.value <= 0) return

        let amountLeft = amount
        let targetBlocks: Block[] = []

        // 1. SELECT TARGETS BASED ON STRATEGY
        if (specificBlockIds && specificBlockIds.length > 0) {
            // Direct targeting of multiple blocks (C4 AoE)
            debts.value.forEach((d: Debt) => {
                d.blocks.forEach((b: Block) => {
                    if (specificBlockIds.indexOf(b.id) !== -1 && b.current > 0) {
                        targetBlocks.push(b)
                    }
                })
            })
        }
        else if (strategy === 'targeted' && targetBlockId) {
            // Precise Laser Shot
            debts.value.forEach((d: Debt) => {
                const block = d.blocks.find((b: Block) => b.id === targetBlockId)
                if (block && block.current > 0) {
                    targetBlocks.push(block)
                }
            })
        }
        else if (strategy === 'random') {
            // ... (keep existing random logic if needed, or deprecate if fully replacing)
            // C4 / Dynamite Logic (Legacy/Fallback)
            let candidateBlocks: Block[] = []

            if (targetDebtId) {
                const debt = debts.value.find((d: Debt) => d.id === targetDebtId)
                if (debt) {
                    candidateBlocks = debt.blocks.filter((b: Block) => b.current > 0)
                }
            } else {
                // Global Chaos (fallback)
                candidateBlocks = debts.value.flatMap((d: Debt) => d.blocks.filter((b: Block) => b.current > 0))
            }

            // Shuffle and pick
            targetBlocks = candidateBlocks.sort(() => 0.5 - Math.random())
        }
        else {
            // Standard (Hammer) - Top Down
            if (targetDebtId && targetDebtId !== 'random') {
                const debt = debts.value.find((d: Debt) => d.id === targetDebtId)
                if (debt) {
                    targetBlocks = debt.blocks.filter((b: Block) => b.current > 0)
                }
            } else {
                // Global Standard (Top Down - we usually just grab all and filter by current > 0)
                debts.value.forEach((d: Debt) => {
                    targetBlocks.push(...d.blocks.filter((b: Block) => b.current > 0))
                })
            }
        }

        // 2. APPLY DAMAGE
        while (amountLeft > 0 && targetBlocks.length > 0) {
            const block = targetBlocks[0]
            if (!block) break;

            const damage = Math.min(block.current, amountLeft)

            block.current -= damage
            amountLeft -= damage

            // Update parent debt paid amount
            const parentDebt = debts.value.find(d => d.id === block.debtId)
            if (parentDebt) {
                if (block.type === 'principal') {
                    parentDebt.paid += damage

                    // Interest Reduction Logic
                    const interestReduction = damage * (parentDebt.interestRate / 100)
                    if (interestReduction > 0) {
                        reduceInterestBlocks(parentDebt, interestReduction)
                    }
                }
            }

            if (block.current <= 0) {
                targetBlocks.shift()
            }
        }

        totalPaidGame.value += (amount - amountLeft)
        saveState()
    }

    function paySpecificBlock(blockId: string, amount: number) {
        makePayment(amount, undefined, 'targeted', blockId)
    }

    function payBlocks(amount: number, blockIds: string[]) {
        makePayment(amount, undefined, 'standard', undefined, blockIds)
    }

    function reduceInterestBlocks(debt: Debt, amount: number) {
        let amountToRemove = amount
        const interestBlocks = debt.blocks.filter((b: Block) => b.type === 'interest' && b.current > 0)
        interestBlocks.sort((a: Block, b: Block) => a.current - b.current)

        while (amountToRemove > 0 && interestBlocks.length > 0) {
            const block = interestBlocks[0]
            if (!block) break;

            const damage = Math.min(block.current, amountToRemove)
            block.current -= damage
            amountToRemove -= damage
            if (block.current <= 0) {
                interestBlocks.shift()
            }
        }
    }

    function resetProgress() {
        debts.value.forEach((d: Debt) => {
            d.paid = 0
            d.blocks.forEach((b: Block) => {
                b.current = b.max
            })
        })
        totalPaidGame.value = 0
        saveState()
    }

    function clearDebts() {
        debts.value = []
        totalPaidGame.value = 0
        saveState()
    }

    // Persistence
    function saveState() {
        localStorage.setItem('debt-tower-state-v3', JSON.stringify({
            debts: debts.value,
            totalPaidGame: totalPaidGame.value
        }))
    }

    function loadState() {
        const saved = localStorage.getItem('debt-tower-state-v3')
        if (saved) {
            const data = JSON.parse(saved)
            debts.value = data.debts || []
            totalPaidGame.value = data.totalPaidGame || 0
        }
    }

    // Initialize
    loadState()

    return {
        debts,
        totalPaidGame,
        totalDebt,
        totalPaid,
        remainingDebt,
        BLOCK_VALUE,
        towerBlocks,
        totalBlocks,
        destroyedBlocks,
        xp,
        addDebt,
        makePayment,
        paySpecificBlock,
        payBlocks,
        resetProgress,
        clearDebts
    }
})
