<script setup lang="ts">
import { ref, computed } from 'vue'
import { useDebtStore, type Debt } from '../stores/debtStore'
import Card from 'primevue/card'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Button from 'primevue/button'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Select from 'primevue/select'

const store = useDebtStore()

const newDebtName = ref('')
const newDebtAmount = ref<number | null>(null)
const newInterestRate = ref<number>(0)
const paymentAmount = ref<number | null>(null)
const selectedDebt = ref<Debt | null>(null)

function addNewDebt() {
    if (newDebtName.value && newDebtAmount.value) {
        store.addDebt(newDebtName.value, newDebtAmount.value, newInterestRate.value || 0)
        newDebtName.value = ''
        newDebtAmount.value = null
        newInterestRate.value = 0
    }
}

function handlePayment() {
    if (paymentAmount.value && paymentAmount.value > 0) {
        // Just pass the selected ID. The store handles random block selection within that debt.
        // If undefined, store handles it as Global Random.
        store.makePayment(paymentAmount.value, selectedDebt.value?.id)
        paymentAmount.value = null
    }
}

function formatCurrency(value: number) {
    return value.toLocaleString('en-GB', { style: 'currency', currency: 'GBP' });
}

// Compute the max payment allowed based on selection
const maxPayment = computed(() => {
    if (selectedDebt.value) {
        return selectedDebt.value.amount - selectedDebt.value.paid
    }
    return store.remainingDebt
})

const activeEnemies = computed(() => {
    // 1. Regular Debts
    const list = store.debts.map(d => ({
        id: d.id,
        name: d.name,
        color: d.color,
        remaining: d.amount - d.paid,
        original: d.amount,
        isInterest: false
    }))

    // 2. Calculate Total Interest Blocks
    let totalInterest = 0
    let originalInterest = 0 // Approximate since we don't track original interest cleanly separate yet, 
                             // but we can sum (debt.amount * rate) roughly or ignore.
                             // Actually, let's sum up current interest blocks from store.
    
    store.debts.forEach(d => {
        d.blocks.forEach(b => {
             if (b.type === 'interest') {
                 if (b.current > 0) totalInterest += b.current
                 originalInterest += b.max // All interest blocks ever created (assuming none deleted fully?)
             }
        })
    })

    if (totalInterest > 0) {
        list.push({
            id: 'interest-enemy',
            name: 'COMPOUND INTEREST',
            color: '#7f1d1d', // Dark Red
            remaining: totalInterest,
            original: originalInterest,
            isInterest: true
        })
    }

    return list
})

const totalActiveDebt = computed(() => {
    return activeEnemies.value.reduce((sum, e) => sum + e.remaining, 0)
})
</script>

<template>
    <div class="space-y-6">
        <!-- Attack Console (Payment) -->
        <Card class="bg-slate-800 border border-slate-700 shadow-xl overflow-visible relative group">
            <template #title>
                <div class="text-xl font-bold text-white flex items-center gap-2">
                    <i class="pi pi-bolt text-yellow-400 animate-pulse"></i>
                    Attack Console
                </div>
            </template>
            <template #content>
                <div class="flex flex-col gap-4">
                    
                    <!-- Target Selector -->
                    <div class="flex flex-col gap-2">
                        <label class="text-slate-400 text-sm uppercase font-bold tracking-wider">Target Enemy</label>
                        <Select v-model="selectedDebt" :options="store.debts" optionLabel="name" placeholder="Select Enemy..." class="w-full text-sm" :pt="{
                            overlay: { class: 'bg-slate-800 border-slate-700' }
                        }">
                            <template #option="slotProps">
                                <div class="flex items-center gap-2 w-full overflow-hidden">
                                    <div class="w-3 h-3 rounded-full shrink-0" :style="{ backgroundColor: slotProps.option.color }"></div>
                                    <div class="truncate font-bold text-slate-200">{{ slotProps.option.name }}</div>
                                    <div class="text-slate-400 text-xs ml-auto font-mono shrink-0">{{ formatCurrency(slotProps.option.amount - slotProps.option.paid) }}</div>
                                </div>
                            </template>
                             <template #value="slotProps">
                                <div v-if="slotProps.value" class="flex items-center gap-2 overflow-hidden">
                                     <div class="w-3 h-3 rounded-full shrink-0" :style="{ backgroundColor: slotProps.value.color }"></div>
                                    <div class="truncate text-slate-200">{{ slotProps.value.name }}</div>
                                </div>
                                <span v-else class="text-slate-400">
                                    {{ slotProps.placeholder }}
                                </span>
                            </template>
                        </Select>
                    </div>

                    <div class="flex flex-col gap-2">
                        <label class="text-slate-400 text-sm uppercase font-bold tracking-wider">Payment Amount</label>
                        <div class="flex gap-2">
                             <InputNumber v-model="paymentAmount" mode="currency" currency="GBP" locale="en-GB" placeholder="0.00" class="flex-1" :min="0" :max="maxPayment" :minFractionDigits="2" :maxFractionDigits="2" />
                             <Button icon="pi pi-send" severity="danger" label="PAY" @click="handlePayment" :disabled="!paymentAmount || paymentAmount <= 0 || !selectedDebt" class="font-bold shrink-0" />
                        </div>
                        <div class="text-xs text-slate-500 text-right">
                           Max: {{ formatCurrency(maxPayment) }}
                        </div>
                    </div>
                </div>
            </template>
        </Card>

        <!-- Reinforcements (Add Debt) -->
        <div class="bg-slate-800/50 border border-slate-700/50 shadow-lg rounded-xl p-6 overflow-visible">
             <div class="text-lg font-bold text-slate-300 flex items-center gap-2 mb-6">
                 <i class="pi pi-plus-circle"></i>
                 Add Load (Debt)
             </div>
             
             <div class="flex flex-col gap-5"> 
                <div class="flex flex-col gap-4">
                     <div class="flex flex-col gap-2">
                         <label class="text-slate-400 text-sm uppercase font-bold tracking-wider">Debt Name</label>
                         <InputText v-model="newDebtName" placeholder="e.g. Visa Card" class="w-full" />
                     </div>
                     <div class="flex flex-col gap-2">
                        <label class="text-slate-400 text-sm uppercase font-bold tracking-wider">Amount</label>
                        <InputNumber v-model="newDebtAmount" mode="currency" currency="GBP" locale="en-GB" placeholder="0.00" class="w-full" :minFractionDigits="2" :maxFractionDigits="2" />
                     </div>
                     <div class="flex flex-col gap-2">
                        <label class="text-slate-400 text-sm uppercase font-bold tracking-wider">Annual Interest Rate (%)</label>
                        <InputNumber v-model="newInterestRate" suffix="%" :min="0" :max="100" placeholder="0%" class="w-full" :minFractionDigits="2" :maxFractionDigits="2" />
                     </div>
                </div>
                <Button label="Add Debt Block" icon="pi pi-plus" severity="secondary" @click="addNewDebt" class="w-full h-12 font-bold" :disabled="!newDebtName || !newDebtAmount" />
             </div>
        </div>
        
        <!-- Debt Table -->
        <div class="mt-4">
             <h3 class="text-sm font-bold text-slate-500 uppercase tracking-widest mb-3">Active Enemies</h3>
             
             <DataTable :value="activeEnemies" size="small" stripedRows tableStyle="min-width: 100%" class="text-sm" scrollable>
                <Column header="Color" style="width: 3rem">
                    <template #body="slotProps">
                         <div class="w-4 h-4 rounded-full shadow-sm flex items-center justify-center text-[8px] font-bold text-slate-800" :style="{ backgroundColor: slotProps.data.color }">
                             <!-- Icon for Interest -->
                            <i v-if="slotProps.data.isInterest" class="pi pi-bolt"></i>
                         </div>
                    </template>
                </Column>
                <Column field="name" header="Name" class="text-slate-200 font-bold"></Column>
                <Column header="Remaining" class="text-slate-300 font-mono text-right">
                    <template #body="slotProps">
                        <span :class="{ 'text-red-400': slotProps.data.isInterest }">{{ formatCurrency(slotProps.data.remaining) }}</span>
                    </template>
                </Column>
                <Column header="Original" class="text-slate-500 font-mono text-right hidden md:table-cell">
                    <template #body="slotProps">
                         {{ formatCurrency(slotProps.data.original) }}
                    </template>
                </Column>
                 <template #footer>
                    <div class="flex justify-between items-center w-full font-bold text-slate-300 px-2">
                        <span class="uppercase tracking-widest text-xs">Total Enemy Power</span>
                        <span class="text-lg font-mono text-red-400">{{ formatCurrency(totalActiveDebt) }}</span>
                    </div>
                </template>
             </DataTable>

             <div v-if="store.debts.length > 0" class="text-right mt-4">
                <Button label="Clear All" text severity="danger" size="small" @click="store.clearDebts" />
            </div>
        </div>
    </div>
</template>

<style scoped>
:deep(.p-card) {
    background: transparent;
    color: inherit;
}
:deep(.p-card-content) {
    padding-top: 0;
}
/* Ensure the Add Debt card never clips focus rings */
.add-debt-card {
    overflow: visible !important;
}
</style>
