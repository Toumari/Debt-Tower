<script setup lang="ts">
import { ref, computed } from 'vue'
import { useDebtStore, type Debt } from '../stores/debtStore'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Button from 'primevue/button'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'

const store = useDebtStore()
const emit = defineEmits(['enable-targeting'])

const newDebtName = ref('')
const newDebtAmount = ref<number | null>(null)
const newInterestRate = ref<number>(0)
const paymentAmount = ref<number | null>(null)
const selectedDebt = ref<Debt | null>(null)

const selectedWeapon = ref<'standard' | 'random' | 'targeted'>('standard')

function addNewDebt() {
    if (newDebtName.value && newDebtAmount.value) {
        store.addDebt(newDebtName.value, newDebtAmount.value, newInterestRate.value || 0)
        newDebtName.value = ''
        newDebtAmount.value = null
        newInterestRate.value = 0
    }
}

    function handleWeaponActivation() {
        if (paymentAmount.value && paymentAmount.value > 0) {
            emit('enable-targeting', { 
                amount: paymentAmount.value, 
                weapon: selectedWeapon.value 
            })
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
    
    // ... (Computed Properties omitted for brevity if unchanged) ... 
    
    // NOTE: computed properties activeEnemies and totalActiveDebt are unchanged but referenced here for context
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
        let originalInterest = 0
        
        store.debts.forEach(d => {
            d.blocks.forEach(b => {
                 if (b.type === 'interest') {
                     if (b.current > 0) totalInterest += b.current
                     originalInterest += b.max 
                 }
            })
        })
    
        if (totalInterest > 0) {
            list.push({
                id: 'interest-enemy',
                name: 'COMPOUND INTEREST',
                color: '#ef4444', 
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
            <div class="glass-card rounded-2xl p-6 border-t border-white/10 relative overflow-hidden group">
                <!-- Background Decoration -->
                <div class="absolute -top-10 -right-10 w-32 h-32 bg-purple-500/20 rounded-full blur-3xl group-hover:bg-purple-500/30 transition-all duration-700"></div>
    
                <div class="relative z-10 flex flex-col gap-6">
                     <div class="flex items-center gap-3 border-b border-white/5 pb-4">
                        <div class="bg-indigo-500/20 p-2 rounded-lg">
                            <i class="pi pi-bolt text-yellow-400 text-xl animate-pulse"></i>
                        </div>
                        <div>
                            <h2 class="text-xl font-black tracking-tight text-white uppercase">Attack Console</h2>
                            <p class="text-xs text-slate-400 font-mono">Weaponize your payments</p>
                        </div>
                     </div>
    
                     <div class="flex flex-col gap-5">
                         <!-- Weapon Selector -->
                         <div class="space-y-2">
                            <label class="text-xs uppercase font-bold text-indigo-300 tracking-wider ml-1 flex justify-between">
                                <span>Select Weapon</span>
                                <span class="text-[10px] text-slate-500 font-normal normal-case italic">Choose your destruction style</span>
                            </label>
                            <div class="grid grid-cols-3 gap-2">
                                <!-- Hammer -->
                                <button @click="selectedWeapon = 'standard'" :class="{'!bg-slate-700 !border-indigo-500 ring-1 ring-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.3)]': selectedWeapon === 'standard'}" class="flex flex-col items-center gap-1 p-3 rounded-xl bg-slate-800/40 border border-slate-700/50 hover:bg-slate-700/60 transition-all group relative overflow-hidden">
                                    <div v-if="selectedWeapon === 'standard'" class="absolute inset-0 bg-indigo-500/10"></div>
                                    <i class="pi pi-hammer text-2xl relative z-10" :class="selectedWeapon === 'standard' ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-300'"></i>
                                    <span class="text-[10px] uppercase font-bold text-slate-400 relative z-10">Hammer</span>
                                </button>
                                
                                <!-- C4 -->
                                <button @click="selectedWeapon = 'random'" :class="{'!bg-slate-700 !border-orange-500 ring-1 ring-orange-500/50 shadow-[0_0_15px_rgba(249,115,22,0.3)]': selectedWeapon === 'random'}" class="flex flex-col items-center gap-1 p-3 rounded-xl bg-slate-800/40 border border-slate-700/50 hover:bg-slate-700/60 transition-all group relative overflow-hidden">
                                    <div v-if="selectedWeapon === 'random'" class="absolute inset-0 bg-orange-500/10"></div>
                                    <i class="pi pi-box text-2xl relative z-10" :class="selectedWeapon === 'random' ? 'text-orange-400' : 'text-slate-500 group-hover:text-slate-300'"></i>
                                    <span class="text-[10px] uppercase font-bold text-slate-400 relative z-10">C4</span>
                                </button>
                                
                                <!-- Laser -->
                                <button @click="selectedWeapon = 'targeted'" :class="{'!bg-slate-700 !border-cyan-500 ring-1 ring-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.3)]': selectedWeapon === 'targeted'}" class="flex flex-col items-center gap-1 p-3 rounded-xl bg-slate-800/40 border border-slate-700/50 hover:bg-slate-700/60 transition-all group relative overflow-hidden">
                                    <div v-if="selectedWeapon === 'targeted'" class="absolute inset-0 bg-cyan-500/10"></div>
                                    <i class="pi pi-bolt text-2xl relative z-10" :class="selectedWeapon === 'targeted' ? 'text-cyan-400' : 'text-slate-500 group-hover:text-slate-300'"></i>
                                    <span class="text-[10px] uppercase font-bold text-slate-400 relative z-10">Laser</span>
                                </button>
                            </div>
                         </div>
    
                          <!-- Amount Input -->
                        <div class="space-y-2">
                             <label class="text-xs uppercase font-bold text-indigo-300 tracking-wider ml-1">Firepower (Amount)</label>
                             <div class="flex flex-col sm:flex-row gap-3">
                                  <InputNumber v-model="paymentAmount" mode="currency" currency="GBP" locale="en-GB" placeholder="£0.00" class="flex-1 w-full" inputClass="!bg-slate-900/50 !border-slate-700/50 !rounded-xl !text-lg !font-mono !text-white focus:!ring-2 focus:!ring-indigo-500/50 !transition-all w-full" :min="0" :max="maxPayment" :minFractionDigits="2" :maxFractionDigits="2" />
                                  
                                  <!-- Universal Engage Button -->
                                  <Button icon="pi pi-crosshairs" label="ENGAGE" @click="handleWeaponActivation" :disabled="!paymentAmount || paymentAmount <= 0"
                                    class="!bg-gradient-to-r !from-indigo-600 !to-purple-600 !border-none !rounded-xl !font-black !tracking-wider !px-8 !py-3 hover:!scale-105 active:!scale-95 !transition-all !shadow-[0_0_20px_rgba(99,102,241,0.4)] disabled:!opacity-50 disabled:!cursor-not-allowed shrink-0 w-full sm:w-auto"
                                  />
                             </div>
                             <div class="flex justify-between text-xs font-mono px-1">
                                <span class="text-slate-500">Available: Wallet Balance (Unlimited)</span>
                                <span class="text-indigo-400">Max Damage: {{ formatCurrency(maxPayment) }}</span>
                             </div>
                        </div>
                     </div>
                </div>
            </div>

        <!-- Reinforcements (Add Debt) -->
        <div class="glass-panel rounded-2xl p-6 relative overflow-hidden">
             <div class="flex items-center gap-3 mb-6">
                 <div class="bg-emerald-500/20 p-2 rounded-lg">
                     <i class="pi pi-plus text-emerald-400 text-lg"></i>
                 </div>
                 <h3 class="text-lg font-bold text-slate-200">Load New Debt</h3>
             </div>
             
             <div class="flex flex-col gap-4"> 
                 <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div class="space-y-2">
                         <label class="text-xs uppercase font-bold text-slate-500 ml-1">Name</label>
                         <InputText v-model="newDebtName" placeholder="e.g. Visa Card" class="w-full !bg-slate-900/30 !border-slate-700/50 !rounded-lg !text-sm focus:!bg-slate-900/80 !transition-colors !text-white" />
                     </div>
                     <div class="space-y-2">
                        <label class="text-xs uppercase font-bold text-slate-500 ml-1">Amount</label>
                        <InputNumber v-model="newDebtAmount" mode="currency" currency="GBP" locale="en-GB" placeholder="£0.00" class="w-full" inputClass="!bg-slate-900/30 !border-slate-700/50 !rounded-lg !text-sm focus:!bg-slate-900/80 !transition-colors !text-white" :minFractionDigits="2" :maxFractionDigits="2" :min="1" />
                     </div>
                 </div>
                 <div class="space-y-2">
                    <label class="text-xs uppercase font-bold text-slate-500 ml-1">APR Interest (%)</label>
                    <InputNumber v-model="newInterestRate" suffix="%" :min="0" :max="100" placeholder="0%" class="w-full" inputClass="!bg-slate-900/30 !border-slate-700/50 !rounded-lg !text-sm focus:!bg-slate-900/80 !transition-colors !text-white" :minFractionDigits="2" :maxFractionDigits="2" />
                 </div>
                 
                 <Button label="Spawn Block" icon="pi pi-box" severity="secondary" @click="addNewDebt" class="w-full !h-10 !font-bold !bg-slate-700/50 hover:!bg-slate-700 !border-slate-600/50 !text-slate-200 !rounded-lg mt-2" :disabled="!newDebtName || !newDebtAmount" />
             </div>
        </div>
        
        <!-- Debt Table -->
        <div class="glass-panel rounded-2xl p-4 overflow-hidden">
             <div class="flex items-center justify-between mb-4 px-2">
                 <h3 class="text-xs font-black text-slate-400 uppercase tracking-widest">Active Threats</h3>
                 <span class="text-xs font-mono text-slate-500">{{ activeEnemies.length }} TARGETS</span>
             </div>
             
             <DataTable :value="activeEnemies" size="small" stripedRows tableStyle="min-width: 100%" class="!bg-transparent text-sm theme-table" scrollable>
                <Column header="" style="width: 2rem">
                    <template #body="slotProps">
                         <div class="w-2 h-8 rounded-full opacity-80" :style="{ backgroundColor: slotProps.data.color }"></div>
                    </template>
                </Column>
                <Column field="name" header="NAME" class="!text-slate-300 !font-bold !bg-transparent text-xs md:text-sm"></Column>
                <Column header="REMAINING" class="!text-slate-200 !font-mono !text-right !bg-transparent">
                    <template #body="slotProps">
                        <span :class="{ 'text-red-400 drop-shadow-[0_0_8px_rgba(248,113,113,0.3)]': slotProps.data.isInterest }">{{ formatCurrency(slotProps.data.remaining) }}</span>
                    </template>
                </Column>
                 <template #footer>
                    <div class="flex justify-between items-center w-full font-bold text-slate-300 px-2 py-2 border-t border-slate-700/50 mt-2">
                        <span class="uppercase tracking-widest text-xs text-slate-400">Total Threat Level</span>
                        <span class="text-lg font-mono text-red-400 drop-shadow-md">{{ formatCurrency(totalActiveDebt) }}</span>
                    </div>
                </template>
             </DataTable>

             <div v-if="store.debts.length > 0" class="text-center mt-2">
                <Button label="Nuke All" icon="pi pi-trash" text severity="danger" size="small" @click="store.clearDebts" class="!text-red-500/60 hover:!text-red-500 !text-xs" />
            </div>
        </div>
    </div>
</template>

<style scoped>
/* Override PrimeVue Table transparency */
:deep(.p-datatable-table) {
    background: transparent !important;
}
:deep(.p-datatable-tbody > tr) {
    background: transparent !important;
    color: #cbd5e1;
}
:deep(.p-datatable-tbody > tr:nth-child(even)) {
    background: rgba(15, 23, 42, 0.3) !important;
}
:deep(.p-datatable-thead > tr > th) {
    background: transparent !important;
    color: #64748b;
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}
:deep(.p-datatable-tbody > tr > td) {
    border: none !important;
    padding: 0.75rem 0.5rem;
}
:deep(.p-datatable-footer) {
    background: transparent !important;
    border: none;
    padding: 0;
}
</style>
