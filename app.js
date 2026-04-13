// Configuración inicial por defecto (Migrada desde data2.js original)
const DEFAULT_DOMAIN = ".local";

const defaultHostsData = [
];

const defaultNotas = [
];

// Estado Global
let state = {
    hosts: [],
    notas: [],
    domain: DEFAULT_DOMAIN,
    darkMode: false
};


let selectedHost = null;
let selectedService = null;
let editMode = false;

// Utilidades
const generateId = () => Date.now().toString(36) + Math.random().toString(36).substring(2);

// LocalStorage Logic
function loadData() {
    const dataStr = localStorage.getItem('facilitatorData');
    if (dataStr) {
        try {
            state = JSON.parse(dataStr);
            if (state.darkMode === undefined) state.darkMode = false;

            // Migrate to specific services per host
            if (!state.migratedToPerHostServices) {

                state.hosts.forEach(h => {
                    if (!h.servicios) h.servicios = [];
                    // Merge old global services
                    if (state.services && state.services[h.tipo]) {
                        state.services[h.tipo].forEach(s => {
                            if (!h.servicios.find(xs => xs.nombre === s.nombre && xs.puerto === s.puerto)) {
                                h.servicios.push({ ...s });
                            }
                        });
                    }
                    if (h.customServiceName && h.customServicePort) {
                        if (!h.servicios.find(xs => xs.nombre === h.customServiceName && xs.puerto === h.customServicePort)) {
                            h.servicios.push({ id: 'c_' + Date.now() + Math.random(), nombre: h.customServiceName, puerto: h.customServicePort, protocolo: (h.customServicePort === '80' ? 'http' : 'https') });
                        }
                        delete h.customServiceName;
                        delete h.customServicePort;
                    }
                });
                delete state.services;
                state.migratedToPerHostServices = true;
                saveData();
            }

            if (!state.notas || state.notas.length === 0) {
                state.notas = JSON.parse(JSON.stringify(defaultNotas));
                saveData();
            }

        } catch (e) {
            console.error("Error validando datos locales", e);
            initDefaultData();
        }
    } else {
        initDefaultData();
    }
}

function initDefaultData() {
    state.hosts = JSON.parse(JSON.stringify(defaultHostsData));
    state.notas = JSON.parse(JSON.stringify(defaultNotas));
    state.domain = DEFAULT_DOMAIN;
    state.darkMode = false;
    saveData();
}

function saveData() {
    localStorage.setItem('facilitatorData', JSON.stringify(state));
}

// UI Render Logic
let draggedNotaIndex = null;

function renderNotas() {
    const container = document.getElementById('notas-container');
    container.innerHTML = "";

    state.notas.forEach((nota, index) => {
        const div = document.createElement('div');
        div.className = 'card-nota';
        if (editMode) div.setAttribute('draggable', 'true');

        div.innerHTML = `
            <div class="drag-handle"><i data-lucide="grip-vertical" class="icon-sm"></i></div>
            <div class="nota-content">${nota.texto}</div>
            <div class="nota-actions">
                <button class="btn-action edit-only" onclick="editarNota('${nota.id}')" title="Editar"><i data-lucide="pencil" class="icon-sm"></i></button>
                <button class="btn-action delete edit-only" onclick="borrarNota('${nota.id}')" title="Eliminar"><i data-lucide="trash-2" class="icon-sm"></i></button>
            </div>
        `;

        if (editMode) {
            div.addEventListener('dragstart', (e) => {
                draggedNotaIndex = index;
                e.dataTransfer.effectAllowed = 'move';
                setTimeout(() => div.classList.add('dragging'), 0);
            });
            div.addEventListener('dragend', () => {
                div.classList.remove('dragging');
                draggedNotaIndex = null;
                renderNotas(); // reset all visual states
            });
            div.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
            });
            div.addEventListener('dragenter', (e) => {
                e.preventDefault();
                if (draggedNotaIndex !== null && index !== draggedNotaIndex) {
                    // Small visual indicator of where it will drop
                    div.style.borderTop = "3px dashed var(--primary)";
                }
            });
            div.addEventListener('dragleave', (e) => {
                div.style.borderTop = "";
            });
            div.addEventListener('drop', (e) => {
                e.preventDefault();
                div.style.borderTop = "";
                if (draggedNotaIndex !== null && draggedNotaIndex !== index) {
                    // Reorder
                    const item = state.notas.splice(draggedNotaIndex, 1)[0];
                    state.notas.splice(index, 0, item);
                    saveData();
                    renderNotas();
                }
            });
        }

        container.appendChild(div);
    });
    if (window.lucide) lucide.createIcons();
}

function renderHosts(filtro = "") {
    const container = document.getElementById('hosts-container');
    container.innerHTML = "";

    // Preparar columnas
    const columns = {
        'application': { title: 'Application', types: ['application', 'service'], html: '' },
        'server': { title: 'Server', types: ['server'], html: '' },
        'networking': { title: 'Networking', types: ['networking'], html: '' },
        'base_station': { title: 'Base Station', types: ['base_station'], html: '' }
    };

    const filteredHosts = state.hosts.filter(h => h.nombre.toLowerCase().includes(filtro.toLowerCase()));

    filteredHosts.forEach(host => {
        let colKey = null;
        for (let key in columns) {
            if (columns[key].types.includes(host.tipo)) {
                colKey = key;
                break;
            }
        }
        if (!colKey) colKey = 'application'; // fallback

        const isSelected = selectedHost && selectedHost.id === host.id ? 'selected' : '';

        columns[colKey].html += `
            <div class="item-wrapper">
                <button class="host-btn cat-${host.tipo} ${isSelected}" onclick="seleccionarHost('${host.id}')">
                    ${host.nombre}
                </button>
                <button class="btn-action edit-only" onclick="editarHost('${host.id}')" title="Editar"><i data-lucide="pencil" class="icon-sm"></i></button>
                <button class="btn-action delete edit-only" onclick="borrarHost('${host.id}')" title="Eliminar"><i data-lucide="trash-2" class="icon-sm"></i></button>
            </div>
        `;
    });

    for (let key in columns) {
        if (columns[key].html) {
            const colDiv = document.createElement('div');
            colDiv.className = 'column';
            colDiv.innerHTML = `<h3>${columns[key].title}</h3><div class="buttons-grid">${columns[key].html}</div>`;
            container.appendChild(colDiv);
        }
    }
    if (window.lucide) lucide.createIcons();
}

function renderServices() {
    const section = document.getElementById('modal-services-selection');
    const container = document.getElementById('services-list');
    const titleSpan = document.getElementById('selected-host-name');

    if (!selectedHost) {
        section.classList.remove('active');
        return;
    }

    titleSpan.textContent = selectedHost.nombre;
    container.innerHTML = "";

    const services = selectedHost.servicios || [];

    if (services.length === 0) {
        container.innerHTML = "<p style='color: gray; font-size: 13px;'>No hay servicios configurados.</p>";
    }

    services.forEach(srv => {
        const isSelected = selectedService && selectedService.id === srv.id ? 'selected' : '';
        const srvHtml = `
            <div class="item-wrapper">
                <button class="service-btn cat-${selectedHost.tipo} ${isSelected}" onclick="seleccionarService('${srv.id}')">
                    ${srv.nombre} (${srv.puerto})
                </button>
            </div>
        `;
        container.innerHTML += srvHtml;
    });
    if (window.lucide) lucide.createIcons();
}

window.seleccionarService = function (srvId) {
    if (!selectedHost) return;
    const services = selectedHost.servicios || [];
    selectedService = services.find(s => s.id === srvId);
    actualizarUrl();
    renderServices();
    if (!editMode) {
        closeModal('modal-services-selection');
    }
};

// Interaction Logic
window.seleccionarHost = function (hostId) {
    selectedHost = state.hosts.find(h => h.id === hostId);
    selectedService = null;

    if (selectedHost) {
        const services = selectedHost.servicios || [];
        if (services.length === 1) {
            selectedService = services[0];
        }
    }

    actualizarUrl();
    renderHosts(document.getElementById('buscador').value);

    if (selectedHost) {
        const services = selectedHost.servicios || [];
        if (services.length !== 1) {
            renderServices();
            document.getElementById('modal-services-selection').classList.add('active');
        } else {
            // Also call renderServices in the background just in case
            renderServices();
        }
    } else {
        renderServices();
    }
};

function actualizarUrl() {
    const input = document.getElementById('url-display');
    const btn = document.getElementById('btn-open-url');

    if (!selectedHost || !selectedService) {
        input.value = "";
        btn.disabled = true;
        return;
    }

    let hostFull = selectedHost.ip;
    let useDomain = selectedHost.usarDominio !== undefined ? selectedHost.usarDominio : !/^\d{1,3}(\.\d{1,3}){3}$/.test(selectedHost.ip);

    if (useDomain && state.domain) {
        hostFull += state.domain;
    }

    const prot = selectedService.protocolo || 'https';
    let portPart = `:${selectedService.puerto}`;
    if ((prot === 'http' && selectedService.puerto === '80') || (prot === 'https' && selectedService.puerto === '443')) {
        portPart = '';
    }
    const url = `${prot}://${hostFull}${portPart}`;

    input.value = url;
    btn.disabled = false;
    btn.onclick = () => window.open(url, "_blank");
}

document.getElementById('buscador').addEventListener('input', (e) => {
    renderHosts(e.target.value);
});

document.getElementById('btn-clear-search').addEventListener('click', () => {
    document.getElementById('buscador').value = "";
    document.getElementById('url-display').value = "";
    selectedHost = null;
    selectedService = null;
    actualizarUrl();
    renderHosts();
    renderServices();
});

// Edit Mode Toggle
document.getElementById('btn-toggle-edit').addEventListener('click', () => {
    editMode = !editMode;
    document.body.classList.toggle('edit-mode', editMode);
    document.getElementById('btn-toggle-edit').innerHTML = editMode ? '<i data-lucide="save" class="icon-sm"></i>' : '<i data-lucide="pencil" class="icon-sm"></i>';
    document.getElementById('btn-toggle-edit').title = editMode ? 'Salir Edición' : 'Modo Edición';
    document.getElementById('btn-toggle-edit').classList.toggle('btn-primary', editMode);
    document.getElementById('btn-toggle-edit').classList.toggle('btn-secondary', !editMode);

    // Toggle notes button
    document.getElementById('btn-add-nota').style.display = editMode ? 'inline-flex' : 'none';

    // Re-render to update drag handles and icons
    renderNotas();
    if (window.lucide) lucide.createIcons();
});

// Modal Logic
window.closeModal = function (id) {
    document.getElementById(id).classList.remove('active');
}

window.addHostServiceRow = function (nombre = '', puerto = '', protocolo = 'https') {
    const container = document.getElementById('host-services-container');
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.gap = '10px';
    row.style.marginBottom = '10px';
    row.className = 'host-service-row';
    row.innerHTML = `
        <input type="text" class="svc-name" placeholder="Nombre (Ej: Web)" value="${nombre}" style="flex:1;">
        <input type="number" class="svc-port" placeholder="Puerto" value="${puerto}" style="width:100px;">
        <select class="svc-prot" style="width:80px">
            <option value="https" ${protocolo === 'https' ? 'selected' : ''}>HTTPS</option>
            <option value="http" ${protocolo === 'http' ? 'selected' : ''}>HTTP</option>
        </select>
        <button type="button" class="btn btn-danger btn-sm" onclick="this.parentElement.remove()"><i data-lucide="trash-2" class="icon-sm"></i></button>
    `;
    container.appendChild(row);
    if (window.lucide) lucide.createIcons();
}

// Hosts CRUD
document.getElementById('btn-add-host').addEventListener('click', () => {
    document.getElementById('form-host').reset();
    document.getElementById('host-id').value = "";
    document.getElementById('host-use-domain').checked = true; // Por defecto activo para hosts nuevos
    document.getElementById('host-services-container').innerHTML = '';
    window.addHostServiceRow('WEB', '443', 'https');
    document.getElementById('modal-host-title').textContent = "Añadir Host";
    document.getElementById('modal-host').classList.add('active');
});

window.editarHost = function (hostId) {
    const host = state.hosts.find(h => h.id === hostId);
    if (!host) return;

    document.getElementById('host-id').value = host.id;
    document.getElementById('host-name').value = host.nombre;
    document.getElementById('host-ip').value = host.ip;
    document.getElementById('host-use-domain').checked = host.usarDominio !== undefined ? host.usarDominio : !/^\d{1,3}(\.\d{1,3}){3}$/.test(host.ip);

    document.getElementById('host-services-container').innerHTML = '';
    if (host.servicios && host.servicios.length > 0) {
        host.servicios.forEach(s => window.addHostServiceRow(s.nombre, s.puerto, s.protocolo));
    } else {
        window.addHostServiceRow('WEB', '443', 'https');
    }

    // Seleccionar tipo de forma segura, o agregar la opcion dinamicamente si no existe
    let select = document.getElementById('host-type');
    let exists = Array.from(select.options).some(o => o.value === host.tipo);
    if (!exists) {
        let opt = document.createElement('option');
        opt.value = host.tipo;
        opt.textContent = host.tipo + ' (Personalizado)';
        select.appendChild(opt);
    }
    select.value = host.tipo;

    document.getElementById('modal-host-title').textContent = "Editar Host";
    document.getElementById('modal-host').classList.add('active');
}

window.borrarHost = function (hostId) {
    if (confirm('¿Estás seguro de que quieres borrar este host?')) {
        state.hosts = state.hosts.filter(h => h.id !== hostId);
        if (selectedHost && selectedHost.id === hostId) {
            selectedHost = null;
            selectedService = null;
        }
        saveData();
        renderHosts();
        renderServices();
        actualizarUrl();
    }
}

document.getElementById('form-host').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('host-id').value;

    const servicios = [];
    document.querySelectorAll('.host-service-row').forEach(row => {
        const nombre = row.querySelector('.svc-name').value.trim();
        const puerto = row.querySelector('.svc-port').value.trim();
        const protocolo = row.querySelector('.svc-prot').value.trim();
        if (nombre && puerto) {
            servicios.push({ id: 's_' + Date.now() + Math.random(), nombre, puerto, protocolo });
        }
    });

    const data = {
        nombre: document.getElementById('host-name').value,
        ip: document.getElementById('host-ip').value,
        tipo: document.getElementById('host-type').value,
        usarDominio: document.getElementById('host-use-domain').checked,
        servicios: servicios
    };

    if (id) {
        const index = state.hosts.findIndex(h => h.id === id);
        if (index > -1) {
            state.hosts[index] = { ...state.hosts[index], ...data };
            if (selectedHost && selectedHost.id === id) selectedHost = state.hosts[index];
        }
    } else {
        state.hosts.push({ id: generateId(), ...data });
    }

    saveData();
    closeModal('modal-host');
    renderHosts();
    if (selectedHost) {
        renderServices();
        actualizarUrl();
    }
});

// Notas CRUD
document.getElementById('btn-add-nota').addEventListener('click', () => {
    document.getElementById('form-nota').reset();
    document.getElementById('nota-id').value = "";
    document.getElementById('modal-nota-title').textContent = "Añadir Nota";
    document.getElementById('modal-nota').classList.add('active');
});

window.editarNota = function (id) {
    const nota = state.notas.find(n => n.id === id);
    if (!nota) return;
    document.getElementById('nota-id').value = nota.id;
    document.getElementById('nota-texto').value = nota.texto;
    document.getElementById('modal-nota-title').textContent = "Editar Nota";
    document.getElementById('modal-nota').classList.add('active');
}

window.borrarNota = function (id) {
    if (confirm('¿Estás seguro de eliminar esta nota?')) {
        state.notas = state.notas.filter(n => n.id !== id);
        saveData();
        renderNotas();
    }
}

document.getElementById('form-nota').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('nota-id').value;
    const txt = document.getElementById('nota-texto').value.trim();
    if (!txt) return;

    if (id) {
        const index = state.notas.findIndex(n => n.id === id);
        if (index > -1) {
            state.notas[index].texto = txt;
        }
    } else {
        state.notas.push({ id: 'n_' + Date.now() + Math.random(), texto: txt });
    }

    saveData();
    closeModal('modal-nota');
    renderNotas();
});

// Import / Export
document.getElementById('btn-export').addEventListener('click', () => {
    const dataStr = JSON.stringify(state, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    let domainStr = (state.domain || '').replace(/^\.+/, '');
    const domainPrefix = domainStr ? `${domainStr}_` : '';
    a.download = `facilitator_${domainPrefix}config_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
});

document.getElementById('input-import').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const importedData = JSON.parse(event.target.result);
            if (importedData.hosts) {
                state = importedData;
                
                // Si el archivo importado es de la versión antigua, no tendrá el flag de migración.
                // Forzamos loadData para que corra la migración en caso de ser necesario.
                if (!state.migratedToPerHostServices) {
                    saveData(); // Guardamos temporalmente
                    loadData(); // Esto ejecutará la migración y actualizará la UI 
                } else {
                    saveData();
                }

                selectedHost = null;
                selectedService = null;
                actualizarUrl();
                renderHosts();
                renderServices();
                alert('Configuración importada exitosamente.');
            } else {
                alert('El archivo no parece tener el formato correcto.');
            }
        } catch (err) {
            alert('Error leyendo el archivo JSON: ' + err.message);
        }
        e.target.value = ""; // reset input
    };
    reader.readAsText(file);
});

// Settings
document.getElementById('btn-settings').addEventListener('click', () => {
    document.getElementById('settings-domain').value = state.domain !== undefined ? state.domain : DEFAULT_DOMAIN;
    document.getElementById('modal-settings').classList.add('active');
});

function updateHeaderDomain() {
    const display = document.getElementById('header-domain-display');
    if (state.domain && state.domain.trim() !== '') {
        display.textContent = `- ${state.domain}`;
        document.title = `Facilitator - ${state.domain}`;
    } else {
        display.textContent = '';
        document.title = 'Facilitator';
    }
}

document.getElementById('form-settings').addEventListener('submit', (e) => {
    e.preventDefault();
    state.domain = document.getElementById('settings-domain').value;
    saveData();
    closeModal('modal-settings');
    updateHeaderDomain();
    actualizarUrl();
});

// Theme Setup
function applyTheme() {
    if (state.darkMode) {
        document.body.classList.add('dark-mode');
        document.getElementById('btn-theme-toggle').innerHTML = '<i data-lucide="sun" class="icon-sm"></i>';
    } else {
        document.body.classList.remove('dark-mode');
        document.getElementById('btn-theme-toggle').innerHTML = '<i data-lucide="moon" class="icon-sm"></i>';
    }
    if (window.lucide) lucide.createIcons();
}

document.getElementById('btn-theme-toggle').addEventListener('click', () => {
    state.darkMode = !state.darkMode;
    saveData();
    applyTheme();
});

// INIT
loadData();
applyTheme();
updateHeaderDomain();
renderHosts();
renderNotas();
