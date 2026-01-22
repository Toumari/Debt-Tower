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
    '#EF4444', // Red
    '#F59E0B', // Amber
    '#10B981', // Emerald
    '#3B82F6', // Blue
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
    const totalDebt = computed(() => debts.value.reduce((sum, d) => sum + d.amount, 0))
    const totalPaid = computed(() => debts.value.reduce((sum, d) => sum + d.paid, 0))
    const remainingDebt = computed(() => totalDebt.value - totalPaid.value)

    // Tower Physics Blocks
    // Only return blocks that are NOT fully destroyed (current > 0)
    const towerBlocks = computed(() => {
        const activeBlocks: any[] = []

        debts.value.forEach(debt => {
            debt.blocks.forEach(block => {
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

    // Payment Logic - Random Destruction
    function makePayment(amount: number, targetDebtId?: string) {
        if (remainingDebt.value <= 0) return

        let amountLeft = amount

        // Target list: specific debt or all debts (default top down? or random?)
        let targetBlocks: Block[] = []

        if (targetDebtId && targetDebtId !== 'random') {
            const debt = debts.value.find(d => d.id === targetDebtId)
            if (debt) {
                targetBlocks = debt.blocks.filter(b => b.current > 0)
            }
        } else {
            // Global Random (Fallback if no target selected)
            // Flatten all active blocks
            debts.value.forEach(d => {
                targetBlocks.push(...d.blocks.filter(b => b.current > 0))
            })
        }

        // Apply damage to smallest blocks first
        while (amountLeft > 0 && targetBlocks.length > 0) {
            // Pick first (smallest)
            const block = targetBlocks[0]

            if (!block) break;

            const damage = Math.min(block.current, amountLeft)

            block.current -= damage
            amountLeft -= damage

            // Update parent debt paid amount
            const parentDebt = debts.value.find(d => d.id === block.debtId)
            if (parentDebt) {
                // If we paid PRINCIPAL, we also need to reduce INTEREST blocks
                if (block.type === 'principal') {
                    parentDebt.paid += damage

                    // Recalculate Interest Reduction
                    // ratio: damage / total_principal * total_interest?
                    // Simpler: 
                    // oldPrincipal = parentDebt.amount - (parentDebt.paid - damage)
                    // newPrincipal = parentDebt.amount - parentDebt.paid
                    // reducedInterest = damage * (rate / 100)

                    const interestReduction = damage * (parentDebt.interestRate / 100)
                    if (interestReduction > 0) {
                        reduceInterestBlocks(parentDebt, interestReduction)
                    }
                }
            }

            // If block destroyed, remove from target list
            if (block.current <= 0) {
                targetBlocks.shift() // Remove the first element since it's destroyed
            }
        }

        totalPaidGame.value += (amount - amountLeft)
        saveState()
    }

    function reduceInterestBlocks(debt: Debt, amount: number) {
        let amountToRemove = amount
        const interestBlocks = debt.blocks.filter(b => b.type === 'interest' && b.current > 0)

        // destroy smallest interest blocks first too?
        interestBlocks.sort((a, b) => a.current - b.current)

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
        debts.value.forEach(d => {
            d.paid = 0
            d.blocks.forEach(b => b.current = b.max)
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
        resetProgress,
        clearDebts
    }
})
