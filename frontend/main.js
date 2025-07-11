/**
 * MultiPark Dashboard - Frontend with Supabase
 */

// Supabase Configuration
const SUPABASE_URL = 'https://sqtmdfwezeqdjyrozsvn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNxdG1kZndlemVxZGp5cm96c3ZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIyNDM1MDUsImV4cCI6MjA2NzgxOTUwNX0.97zp8iPoaTwKmoVuH-_wpb1G3xG3A_QxgGhZgg6HcDs';

// Import Supabase (CDN)
const script = document.createElement('script');
script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.39.7/dist/umd/supabase.min.js';
script.onload = () => {
    // Initialize Supabase client
    window.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('🚀 Supabase connected!');
};
document.head.appendChild(script);

// Global State
let appState = {
    bookings: [],
    dashboardStats: null,
    isLoading: false
};

// Initialize App
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
    // Wait for Supabase to load
    setTimeout(() => {
        loadDashboardStats();
    }, 1000);
});

function initializeApp() {
    console.log('🚀 MultiPark Dashboard initialized');
    showSection('dashboard');
}

// Event Listeners
function setupEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const section = this.dataset.section;
            showSection(section);
            
            // Update active nav
            document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
            this.classList.add('active');
            
            // Update page title
            const title = this.textContent.trim();
            document.getElementById('page-title').textContent = title;
        });
    });
    
    // Excel Upload
    const fileInput = document.getElementById('excel-file');
    const uploadZone = document.getElementById('upload-zone');
    
    if (fileInput) {
        fileInput.addEventListener('change', handleFileUpload);
    }
    
    // Drag & Drop
    if (uploadZone) {
        uploadZone.addEventListener('dragover', function(e) {
            e.preventDefault();
            this.classList.add('dragover');
        });
        
        uploadZone.addEventListener('dragleave', function(e) {
            e.preventDefault();
            this.classList.remove('dragover');
        });
        
        uploadZone.addEventListener('drop', function(e) {
            e.preventDefault();
            this.classList.remove('dragover');
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                processFile(files[0]);
            }
        });
    }
    
    // Filters
    const brandFilter = document.getElementById('brand-filter');
    const approvalFilter = document.getElementById('approval-filter');
    
    if (brandFilter) brandFilter.addEventListener('change', filterBookings);
    if (approvalFilter) approvalFilter.addEventListener('change', filterBookings);
    
    // Select All Checkbox
    const selectAll = document.getElementById('select-all');
    if (selectAll) {
        selectAll.addEventListener('change', function() {
            const checkboxes = document.querySelectorAll('.booking-checkbox');
            checkboxes.forEach(cb => cb.checked = this.checked);
        });
    }
}

// Navigation
function showSection(sectionId) {
    // Hide all sections
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Show target section
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.classList.add('active');
        
        // Load section-specific data
        if (sectionId === 'bookings') {
            loadBookings();
        } else if (sectionId === 'partner') {
            loadPartnerFinancials();
        } else if (sectionId === 'multipark') {
            loadMultiparkFinancials();
        }
    }
}

// File Upload with Supabase Edge Function
function handleFileUpload(event) {
    const file = event.target.files[0];
    if (file) {
        processFile(file);
    }
}

async function processFile(file) {
    if (!file.name.match(/\.(xlsx|xls)$/)) {
        showToast('Por favor seleccione um ficheiro Excel (.xlsx ou .xls)', 'error');
        return;
    }
    
    if (!window.supabase) {
        showToast('A carregar Supabase...', 'warning');
        return;
    }
    
    showLoadingModal(true);
    showUploadProgress(true);
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
        updateProgress(20, 'A carregar ficheiro...');
        
        // Call Supabase Edge Function
        const { data, error } = await window.supabase.functions.invoke('process-excel', {
            body: formData
        });
        
        updateProgress(60, 'A processar dados...');
        
        if (error) {
            throw error;
        }
        
        updateProgress(100, 'Concluído!');
        
        setTimeout(() => {
            showLoadingModal(false);
            showUploadProgress(false);
            showUploadResult(data);
            loadDashboardStats();
            showToast(`Processados ${data.bookings_count} registos com sucesso!`, 'success');
        }, 1000);
        
    } catch (error) {
        console.error('Erro upload:', error);
        showLoadingModal(false);
        showUploadProgress(false);
        showToast('Erro ao processar ficheiro: ' + error.message, 'error');
    }
}

function showUploadProgress(show) {
    const progressDiv = document.getElementById('upload-progress');
    if (progressDiv) {
        progressDiv.style.display = show ? 'block' : 'none';
        
        if (!show) {
            updateProgress(0, '');
        }
    }
}

function updateProgress(percentage, text) {
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');
    
    if (progressFill) progressFill.style.width = percentage + '%';
    if (progressText) progressText.textContent = text;
}

function showUploadResult(result) {
    const resultDiv = document.getElementById('upload-result');
    if (resultDiv) {
        resultDiv.innerHTML = `
            <div class="upload-success">
                <h4>✅ Upload Concluído</h4>
                <div class="result-stats">
                    <div class="stat">
                        <strong>${result.bookings_count}</strong>
                        <span>Registos processados</span>
                    </div>
                    <div class="stat">
                        <strong>${result.needs_approval}</strong>
                        <span>Aguardam aprovação</span>
                    </div>
                </div>
                <div class="result-actions">
                    <button class="btn btn-primary" onclick="showSection('bookings')">
                        Ver Bookings
                    </button>
                    <button class="btn btn-success" onclick="showSection('dashboard')">
                        Ir para Dashboard
                    </button>
                </div>
            </div>
        `;
        resultDiv.style.display = 'block';
    }
}

// Dashboard with Supabase data
async function loadDashboardStats() {
    if (!window.supabase) {
        console.log('Supabase not loaded yet');
        return;
    }
    
    try {
        // Get bookings count
        const { data: bookings, error: bookingsError } = await window.supabase
            .from('bookings')
            .select('*');
        
        if (bookingsError) throw bookingsError;
        
        // Get financial splits
        const { data: splits, error: splitsError } = await window.supabase
            .from('financial_splits')
            .select('*');
        
        if (splitsError) throw splitsError;
        
        // Calculate stats
        const totalBookings = bookings.length;
        const pendingApproval = bookings.filter(b => b.needs_approval && !b.status_approved).length;
        const totalAmount = splits.reduce((sum, s) => sum + parseFloat(s.total_amount), 0);
        const partnerAmount = splits.reduce((sum, s) => sum + parseFloat(s.partner_amount_60), 0);
        const multiparkAmount = splits.reduce((sum, s) => sum + parseFloat(s.multipark_amount_40), 0);
        const approvalRate = totalBookings > 0 ? Math.round((totalBookings - pendingApproval) / totalBookings * 100) : 0;
        
        const stats = {
            total_bookings: totalBookings,
            pending_approval: pendingApproval,
            total_amount: totalAmount,
            partner_60_percent: partnerAmount,
            multipark_40_percent: multiparkAmount,
            approval_rate: approvalRate
        };
        
        appState.dashboardStats = stats;
        updateDashboardDisplay(stats);
        
    } catch (error) {
        console.error('Erro carregar dashboard:', error);
        // Show default values
        updateDashboardDisplay({
            total_bookings: 0,
            pending_approval: 0,
            total_amount: 0,
            partner_60_percent: 0,
            multipark_40_percent: 0,
            approval_rate: 0
        });
    }
}

function updateDashboardDisplay(stats) {
    const totalBookingsEl = document.getElementById('total-bookings');
    const pendingApprovalEl = document.getElementById('pending-approval');
    const totalAmountEl = document.getElementById('total-amount');
    const approvalRateEl = document.getElementById('approval-rate');
    const partnerAmountEl = document.getElementById('partner-amount');
    const multiparkAmountEl = document.getElementById('multipark-amount');
    
    if (totalBookingsEl) totalBookingsEl.textContent = stats.total_bookings;
    if (pendingApprovalEl) pendingApprovalEl.textContent = stats.pending_approval;
    if (totalAmountEl) totalAmountEl.textContent = `€${stats.total_amount.toFixed(2)}`;
    if (approvalRateEl) approvalRateEl.textContent = `${stats.approval_rate}%`;
    if (partnerAmountEl) partnerAmountEl.textContent = `€${stats.partner_60_percent.toFixed(2)}`;
    if (multiparkAmountEl) multiparkAmountEl.textContent = `€${stats.multipark_40_percent.toFixed(2)}`;
    
    updateRecentActivities(stats);
}

function updateRecentActivities(stats) {
    const activitiesContainer = document.getElementById('recent-activities');
    if (!activitiesContainer) return;
    
    if (stats.total_bookings === 0) {
        activitiesContainer.innerHTML = `
            <div class="activity-item">
                <i class="fas fa-info-circle"></i>
                <span>Carregue um ficheiro Excel para começar</span>
            </div>
        `;
        return;
    }
    
    const activities = [
        {
            icon: 'fas fa-upload',
            text: `${stats.total_bookings} bookings carregados`
        },
        {
            icon: 'fas fa-clock',
            text: `${stats.pending_approval} aguardam aprovação`
        },
        {
            icon: 'fas fa-euro-sign',
            text: `€${stats.total_amount.toFixed(2)} valor total processado`
        }
    ];
    
    activitiesContainer.innerHTML = activities.map(activity => `
        <div class="activity-item">
            <i class="${activity.icon}"></i>
            <span>${activity.text}</span>
        </div>
    `).join('');
}

// Bookings Management with Supabase
async function loadBookings(filters = {}) {
    if (!window.supabase) return;
    
    try {
        let query = window.supabase
            .from('bookings')
            .select(`
                *,
                financial_splits (
                    partner_amount_60,
                    multipark_amount_40,
                    total_amount
                )
            `)
            .order('created_at', { ascending: false });
        
        if (filters.needs_approval !== undefined) {
            query = query.eq('needs_approval', filters.needs_approval);
        }
        
        const { data: bookings, error } = await query;
        if (error) throw error;
        
        appState.bookings = bookings;
        updateBookingsTable(bookings);
        updateBrandFilter(bookings);
        
    } catch (error) {
        console.error('Erro carregar bookings:', error);
        showToast('Erro ao carregar bookings', 'error');
    }
}

function updateBookingsTable(bookings) {
    const tbody = document.querySelector('#bookings-table tbody');
    if (!tbody) return;
    
    if (bookings.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="10" style="text-align: center; padding: 2rem;">
                    <i class="fas fa-inbox" style="font-size: 2rem; color: var(--text-muted); margin-bottom: 1rem;"></i>
                    <p>Nenhum booking encontrado. Carregue um ficheiro Excel primeiro.</p>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = bookings.map(booking => {
        const statusClass = getRowStatusClass(booking);
        const statusText = booking.status_approved ? 'Aprovado' : 'Pendente';
        const statusBadgeClass = booking.status_approved ? 'approved' : 'pending';
        const split = booking.financial_splits?.[0] || {};
        
        return `
            <tr class="${statusClass}">
                <td>
                    <input type="checkbox" class="booking-checkbox" value="${booking.id}">
                </td>
                <td><strong>${booking.license_plate}</strong></td>
                <td>${booking.name} ${booking.lastname || ''}</td>
                <td>${formatTimestamp(booking.checkout_timestamp)}</td>
                <td>${booking.checkout_formatted || '-'}</td>
                <td>
                    ${getDifferenceDisplay(booking.date_difference_days, booking.needs_approval)}
                </td>
                <td><strong>€${parseFloat(booking.price_delivery).toFixed(2)}</strong></td>
                <td><span class="brand-tag">${booking.park_brand || '-'}</span></td>
                <td>
                    <span class="status-badge ${statusBadgeClass}">${statusText}</span>
                </td>
                <td>
                    ${booking.status_approved ? 
                        '<span class="text-muted">Aprovado</span>' :
                        `<button class="btn btn-success btn-sm" onclick="approveBooking(${booking.id})">
                            <i class="fas fa-check"></i> OK
                        </button>`
                    }
                </td>
            </tr>
        `;
    }).join('');
}

function getRowStatusClass(booking) {
    if (booking.date_difference_days === 0) return 'success';
    if (booking.date_difference_days === 1 && !booking.needs_approval) return 'warning';
    return 'danger';
}

function getDifferenceDisplay(days, needsApproval) {
    if (days === 0) {
        return '<span class="text-success">✅ Igual</span>';
    } else if (days === 1 && !needsApproval) {
        return '<span class="text-warning">⚠️ 1 dia</span>';
    } else {
        return `<span class="text-danger">❌ ${days} dias</span>`;
    }
}

function formatTimestamp(timestamp) {
    if (!timestamp) return '-';
    const date = new Date(timestamp);
    return date.toLocaleString('pt-PT');
}

// Approval Functions with Supabase
async function approveBooking(bookingId) {
    if (!window.supabase) return;
    
    try {
        const { data, error } = await window.supabase
            .from('bookings')
            .update({ 
                status_approved: true, 
                approved_at: new Date().toISOString() 
            })
            .eq('id', bookingId);
        
        if (error) throw error;
        
        showToast('Booking aprovado com sucesso!', 'success');
        loadBookings();
        loadDashboardStats();
        
    } catch (error) {
        console.error('Erro aprovar booking:', error);
        showToast('Erro ao aprovar booking', 'error');
    }
}

async function approveAllPending() {
    const pendingBookings = appState.bookings.filter(b => !b.status_approved && b.needs_approval);
    
    if (pendingBookings.length === 0) {
        showToast('Não há bookings pendentes para aprovar', 'warning');
        return;
    }
    
    if (!confirm(`Aprovar ${pendingBookings.length} bookings pendentes?`)) {
        return;
    }
    
    showLoadingModal(true);
    
    try {
        const { data, error } = await window.supabase
            .from('bookings')
            .update({ 
                status_approved: true, 
                approved_at: new Date().toISOString() 
            })
            .in('id', pendingBookings.map(b => b.id));
        
        if (error) throw error;
        
        showLoadingModal(false);
        showToast(`${pendingBookings.length} bookings aprovados!`, 'success');
        loadBookings();
        loadDashboardStats();
        
    } catch (error) {
        showLoadingModal(false);
        console.error('Erro aprovar lote:', error);
        showToast('Erro ao aprovar bookings em lote', 'error');
    }
}

// Filters
function updateBrandFilter(bookings) {
    const brandFilter = document.getElementById('brand-filter');
    if (!brandFilter) return;
    
    const brands = [...new Set(bookings.map(b => b.park_brand).filter(Boolean))];
    
    brandFilter.innerHTML = '<option value="">Todas as marcas</option>' +
        brands.map(brand => `<option value="${brand}">${brand}</option>`).join('');
}

function filterBookings() {
    const brandFilter = document.getElementById('brand-filter');
    const approvalFilter = document.getElementById('approval-filter');
    
    const brandValue = brandFilter?.value || '';
    const approvalValue = approvalFilter?.value || '';
    
    let filteredBookings = [...appState.bookings];
    
    if (brandValue) {
        filteredBookings = filteredBookings.filter(b => b.park_brand === brandValue);
    }
    
    if (approvalValue === 'pending') {
        filteredBookings = filteredBookings.filter(b => !b.status_approved);
    } else if (approvalValue === 'approved') {
        filteredBookings = filteredBookings.filter(b => b.status_approved);
    }
    
    updateBookingsTable(filteredBookings);
}

// Financial Sections (placeholders)
async function loadPartnerFinancials() {
    showToast('Secção em desenvolvimento', 'info');
}

async function loadMultiparkFinancials() {
    showToast('Secção em desenvolvimento', 'info');
}

function exportPartnerData() {
    showToast('Função de export será implementada', 'warning');
}

function exportMultiparkData() {
    showToast('Função de export será implementada', 'warning');
}

// UI Utilities
function showLoadingModal(show) {
    const modal = document.getElementById('loading-modal');
    if (modal) {
        modal.classList.toggle('active', show);
    }
}

function showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toast-container') || document.body;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        color: white;
        font-weight: 500;
        z-index: 9999;
        max-width: 400px;
    `;
    
    const colors = {
        success: '#22c55e',
        error: '#ef4444', 
        warning: '#f59e0b',
        info: '#3b82f6'
    };
    
    toast.style.backgroundColor = colors[type] || colors.info;
    
    toast.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between;">
            <span>${message}</span>
            <button onclick="this.parentElement.parentElement.remove()" 
                    style="background: none; border: none; color: white; font-size: 1.2em; cursor: pointer; margin-left: 1rem;">
                &times;
            </button>
        </div>
    `;
    
    toastContainer.appendChild(toast);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (toast.parentElement) {
            toast.remove();
        }
    }, 5000);
}

// Add CSS for styling
const style = document.createElement('style');
style.textContent = `
    .upload-success {
        text-align: center;
        padding: 2rem 1rem;
    }
    
    .upload-success h4 {
        color: #22c55e;
        margin-bottom: 1.5rem;
    }
    
    .result-stats {
        display: flex;
        justify-content: center;
        gap: 2rem;
        margin-bottom: 2rem;
    }
    
    .result-stats .stat {
        text-align: center;
    }
    
    .result-stats strong {
        display: block;
        font-size: 1.5rem;
        color: #2563eb;
        margin-bottom: 0.25rem;
    }
    
    .result-actions {
        display: flex;
        gap: 1rem;
        justify-content: center;
    }
    
    .brand-tag {
        background: #f1f5f9;
        padding: 0.25rem 0.5rem;
        border-radius: 4px;
        font-size: 0.75rem;
        text-transform: uppercase;
        font-weight: 500;
    }
    
    .text-success { color: #22c55e; }
    .text-warning { color: #f59e0b; }
    .text-danger { color: #ef4444; }
    .text-muted { color: #64748b; }
    
    .status-badge { 
        padding: 0.25rem 0.5rem; 
        border-radius: 4px; 
        font-size: 0.75rem; 
        font-weight: 500; 
    }
    .status-badge.approved { 
        background: #d1fae5; 
        color: #065f46; 
    }
    .status-badge.pending { 
        background: #fef3c7; 
        color: #92400e; 
    }
`;
document.head.appendChild(style);