/**
 * MultiPark Dashboard - Frontend Logic
 */

// API Configuration
const API_BASE_URL = 'http://localhost:8000/api';

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
    loadDashboardStats();
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
    
    fileInput.addEventListener('change', handleFileUpload);
    
    // Drag & Drop
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
    
    // Filters
    document.getElementById('brand-filter').addEventListener('change', filterBookings);
    document.getElementById('approval-filter').addEventListener('change', filterBookings);
    
    // Select All Checkbox
    document.getElementById('select-all').addEventListener('change', function() {
        const checkboxes = document.querySelectorAll('.booking-checkbox');
        checkboxes.forEach(cb => cb.checked = this.checked);
    });
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

// File Upload
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
    
    showLoadingModal(true);
    showUploadProgress(true);
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
        // Simulate progress
        updateProgress(20, 'A carregar ficheiro...');
        
        const response = await fetch(`${API_BASE_URL}/upload-excel`, {
            method: 'POST',
            body: formData
        });
        
        updateProgress(60, 'A processar dados...');
        
        if (!response.ok) {
            throw new Error(`Erro HTTP: ${response.status}`);
        }
        
        const result = await response.json();
        
        updateProgress(100, 'Concluído!');
        
        setTimeout(() => {
            showLoadingModal(false);
            showUploadProgress(false);
            showUploadResult(result);
            loadDashboardStats();
            showToast(`Processados ${result.bookings_count} registos com sucesso!`, 'success');
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
    progressDiv.style.display = show ? 'block' : 'none';
    
    if (!show) {
        updateProgress(0, '');
    }
}

function updateProgress(percentage, text) {
    document.getElementById('progress-fill').style.width = percentage + '%';
    document.getElementById('progress-text').textContent = text;
}

function showUploadResult(result) {
    const resultDiv = document.getElementById('upload-result');
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

// Dashboard
async function loadDashboardStats() {
    try {
        const response = await fetch(`${API_BASE_URL}/dashboard/stats`);
        if (!response.ok) throw new Error('Erro ao carregar estatísticas');
        
        const stats = await response.json();
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
    document.getElementById('total-bookings').textContent = stats.total_bookings;
    document.getElementById('pending-approval').textContent = stats.pending_approval;
    document.getElementById('total-amount').textContent = `€${stats.total_amount.toFixed(2)}`;
    document.getElementById('approval-rate').textContent = `${stats.approval_rate}%`;
    
    document.getElementById('partner-amount').textContent = `€${stats.partner_60_percent.toFixed(2)}`;
    document.getElementById('multipark-amount').textContent = `€${stats.multipark_40_percent.toFixed(2)}`;
    
    updateRecentActivities(stats);
}

function updateRecentActivities(stats) {
    const activitiesContainer = document.getElementById('recent-activities');
    
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

// Bookings Management
async function loadBookings(filters = {}) {
    try {
        const params = new URLSearchParams();
        if (filters.needs_approval !== undefined) {
            params.append('needs_approval', filters.needs_approval);
        }
        
        const response = await fetch(`${API_BASE_URL}/bookings?${params}`);
        if (!response.ok) throw new Error('Erro ao carregar bookings');
        
        const bookings = await response.json();
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
        
        return `
            <tr class="${statusClass}">
                <td>
                    <input type="checkbox" class="booking-checkbox" value="${booking.id}">
                </td>
                <td><strong>${booking.license_plate}</strong></td>
                <td>${booking.name} ${booking.lastname}</td>
                <td>${formatTimestamp(booking.checkout_timestamp)}</td>
                <td>${booking.checkout_formatted}</td>
                <td>
                    ${getDifferenceDisplay(booking.date_difference_days, booking.needs_approval)}
                </td>
                <td><strong>€${booking.price_delivery.toFixed(2)}</strong></td>
                <td><span class="brand-tag">${booking.park_brand}</span></td>
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

// Approval Functions
async function approveBooking(bookingId) {
    try {
        const response = await fetch(`${API_BASE_URL}/bookings/${bookingId}/approve`, {
            method: 'PATCH'
        });
        
        if (!response.ok) throw new Error('Erro ao aprovar booking');
        
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
        const promises = pendingBookings.map(booking => 
            fetch(`${API_BASE_URL}/bookings/${booking.id}/approve`, { method: 'PATCH' })
        );
        
        await Promise.all(promises);
        
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
    const brands = [...new Set(bookings.map(b => b.park_brand).filter(Boolean))];
    
    brandFilter.innerHTML = '<option value="">Todas as marcas</option>' +
        brands.map(brand => `<option value="${brand}">${brand}</option>`).join('');
}

function filterBookings() {
    const brandFilter = document.getElementById('brand-filter').value;
    const approvalFilter = document.getElementById('approval-filter').value;
    
    let filteredBookings = [...appState.bookings];
    
    if (brandFilter) {
        filteredBookings = filteredBookings.filter(b => b.park_brand === brandFilter);
    }
    
    if (approvalFilter === 'pending') {
        filteredBookings = filteredBookings.filter(b => !b.status_approved);
    } else if (approvalFilter === 'approved') {
        filteredBookings = filteredBookings.filter(b => b.status_approved);
    }
    
    updateBookingsTable(filteredBookings);
}

// Financial Sections
async function loadPartnerFinancials() {
    try {
        const response = await fetch(`${API_BASE_URL}/financial/partner`);
        // For now, show placeholder
        showFinancialBreakdown('partner', []);
    } catch (error) {
        console.error('Erro carregar financials parceiro:', error);
    }
}

async function loadMultiparkFinancials() {
    try {
        const response = await fetch(`${API_BASE_URL}/financial/multipark`);
        // For now, show placeholder
        showFinancialBreakdown('multipark', []);
    } catch (error) {
        console.error('Erro carregar financials multipark:', error);
    }
}

function showFinancialBreakdown(type, data) {
    const container = document.getElementById(`${type}-by-brand`);
    const paymentContainer = document.getElementById(`${type}-by-payment`);
    
    if (data.length === 0) {
        const message = `
            <div class="activity-item">
                <i class="fas fa-info-circle"></i>
                <span>Carregue dados primeiro para ver breakdown financeiro</span>
            </div>
        `;
        container.innerHTML = message;
        paymentContainer.innerHTML = message;
        return;
    }
    
    // Implement breakdown display
}

// Export Functions
function exportPartnerData() {
    showToast('Função de export será implementada', 'warning');
}

function exportMultiparkData() {
    showToast('Função de export será implementada', 'warning');
}

// UI Utilities
function showLoadingModal(show) {
    const modal = document.getElementById('loading-modal');
    modal.classList.toggle('active', show);
}

function showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toast-container');
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between;">
            <span>${message}</span>
            <button onclick="this.parentElement.parentElement.remove()" 
                    style="background: none; border: none; font-size: 1.2em; cursor: pointer; margin-left: 1rem;">
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

// Add some CSS for upload result
const style = document.createElement('style');
style.textContent = `
    .upload-success {
        text-align: center;
        padding: 2rem 1rem;
    }
    
    .upload-success h4 {
        color: var(--success-color);
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
        color: var(--primary-color);
        margin-bottom: 0.25rem;
    }
    
    .result-actions {
        display: flex;
        gap: 1rem;
        justify-content: center;
    }
    
    .brand-tag {
        background: var(--bg-color);
        padding: 0.25rem 0.5rem;
        border-radius: 4px;
        font-size: 0.75rem;
        text-transform: uppercase;
        font-weight: 500;
    }
    
    .text-success { color: var(--success-color); }
    .text-warning { color: var(--warning-color); }
    .text-danger { color: var(--danger-color); }
    .text-muted { color: var(--text-muted); }
`;
document.head.appendChild(style);
