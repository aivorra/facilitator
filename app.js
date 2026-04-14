// Configuración inicial por defecto (Migrada desde data2.js original)
const APP_VERSION = "2.2";
const GITHUB_REPO = "aivorra/facilitator";
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

            if (!state.migratedToNetworks) {
                const defaultRedId = 'red_default_' + Date.now();
                state.redes = [
                    { id: defaultRedId, nombre: 'Red Local', domain: state.domain || DEFAULT_DOMAIN }
                ];
                state.activeRedId = defaultRedId;

                if (state.hosts) {
                    state.hosts.forEach(h => h.redId = defaultRedId);
                }
                if (state.notas) {
                    state.notas.forEach(n => n.redId = defaultRedId);
                }

                state.migratedToNetworks = true;
                saveData();
            }
            if (!state.activeRedId && state.redes && state.redes.length > 0) {
                state.activeRedId = state.redes[0].id;
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
    const defaultRedId = 'red_default_' + Date.now();
    state.hosts = JSON.parse(JSON.stringify(defaultHostsData));
    state.notas = JSON.parse(JSON.stringify(defaultNotas));
    state.domain = DEFAULT_DOMAIN;
    state.darkMode = false;
    state.redes = [{ id: defaultRedId, nombre: 'Red Local', domain: DEFAULT_DOMAIN }];
    state.activeRedId = defaultRedId;
    state.migratedToNetworks = true;
    state.migratedToPerHostServices = true;
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

    const filteredNotas = state.notas.filter(n => n.redId === state.activeRedId);
    filteredNotas.forEach((nota, idx) => {
        const index = state.notas.indexOf(nota);
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

let draggedHostIndex = null;

function renderHosts(filtro = "") {
    const container = document.getElementById('hosts-container');
    container.innerHTML = "";

    // Preparar columnas
    const columns = {
        'application': { title: 'Application', types: ['application', 'service'], elements: [] },
        'server': { title: 'Server', types: ['server'], elements: [] },
        'networking': { title: 'Networking', types: ['networking'], elements: [] },
        'base_station': { title: 'Base Station', types: ['base_station'], elements: [] }
    };

    const q = filtro.toLowerCase();
    const filteredHosts = state.hosts.filter(h => {
        if (h.redId !== state.activeRedId) return false;
        if (!q) return true;
        if (h.nombre.toLowerCase().includes(q)) return true;
        if (h.ip && h.ip.toLowerCase().includes(q)) return true;
        if (h.servicios && h.servicios.some(s => s.nombre.toLowerCase().includes(q))) return true;
        return false;
    });

    filteredHosts.forEach(host => {
        let colKey = null;
        for (let key in columns) {
            if (columns[key].types.includes(host.tipo)) {
                colKey = key;
                break;
            }
        }
        if (!colKey) colKey = 'application'; // fallback

        const indexInGlobal = state.hosts.indexOf(host);
        const isSelected = selectedHost && selectedHost.id === host.id ? 'selected' : '';

        const div = document.createElement('div');
        div.className = 'item-wrapper';
        if (editMode && filtro === "") {
            div.setAttribute('draggable', 'true');
        }

        div.innerHTML = `
            ${editMode && filtro === "" ? '<div class="drag-handle" style="display:flex; align-items:center; cursor:grab; color:var(--text-secondary);"><i data-lucide="grip-vertical" class="icon-sm"></i></div>' : ''}
            <button class="host-btn cat-${host.tipo} ${isSelected}" onclick="seleccionarHost('${host.id}')" style="flex:1;">
                ${host.nombre}
            </button>
            <button class="btn-action edit-only" onclick="editarHost('${host.id}')" title="Editar"><i data-lucide="pencil" class="icon-sm"></i></button>
            <button class="btn-action delete edit-only" onclick="borrarHost('${host.id}')" title="Eliminar"><i data-lucide="trash-2" class="icon-sm"></i></button>
        `;

        if (editMode && filtro === "") {
            div.addEventListener('dragstart', (e) => {
                draggedHostIndex = indexInGlobal;
                e.dataTransfer.effectAllowed = 'move';
                setTimeout(() => div.classList.add('dragging'), 0);
            });
            div.addEventListener('dragend', () => {
                div.classList.remove('dragging');
                draggedHostIndex = null;
                renderHosts(filtro);
            });
            div.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
            });
            div.addEventListener('dragenter', (e) => {
                e.preventDefault();
                if (draggedHostIndex !== null && indexInGlobal !== draggedHostIndex) {
                    div.style.borderTop = "3px dashed var(--primary)";
                }
            });
            div.addEventListener('dragleave', (e) => {
                div.style.borderTop = "";
            });
            div.addEventListener('drop', (e) => {
                e.preventDefault();
                div.style.borderTop = "";
                if (draggedHostIndex !== null && draggedHostIndex !== indexInGlobal) {
                    const item = state.hosts.splice(draggedHostIndex, 1)[0];
                    let dropIndex = state.hosts.indexOf(host);
                    if (dropIndex === -1) dropIndex = state.hosts.length;

                    state.hosts.splice(dropIndex, 0, item);
                    saveData();
                    renderHosts(filtro);
                }
            });
        }

        columns[colKey].elements.push(div);
    });

    for (let key in columns) {
        if (columns[key].elements.length > 0) {
            const colDiv = document.createElement('div');
            colDiv.className = 'column';
            const h3 = document.createElement('h3');
            h3.textContent = columns[key].title;
            colDiv.appendChild(h3);

            const gridDiv = document.createElement('div');
            gridDiv.className = 'buttons-grid';
            columns[key].elements.forEach(el => gridDiv.appendChild(el));

            colDiv.appendChild(gridDiv);
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
    const currentRed = state.redes ? state.redes.find(r => r.id === selectedHost.redId) : null;

    if (useDomain && currentRed && currentRed.domain) {
        hostFull += currentRed.domain;
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
    renderHosts(document.getElementById('buscador') ? document.getElementById('buscador').value : "");
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
    document.getElementById('host-use-domain').checked = false;
    document.getElementById('host-red').value = state.activeRedId;
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
    document.getElementById('host-red').value = host.redId || state.activeRedId;
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
        redId: document.getElementById('host-red').value,
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
    document.getElementById('nota-red').value = state.activeRedId;
    document.getElementById('modal-nota-title').textContent = "Añadir Nota";
    document.getElementById('modal-nota').classList.add('active');
});

window.editarNota = function (id) {
    const nota = state.notas.find(n => n.id === id);
    if (!nota) return;
    document.getElementById('nota-id').value = nota.id;
    document.getElementById('nota-texto').value = nota.texto;
    document.getElementById('nota-red').value = nota.redId || state.activeRedId;
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
    const redId = document.getElementById('nota-red').value;

    if (id) {
        const index = state.notas.findIndex(n => n.id === id);
        if (index > -1) {
            state.notas[index].texto = txt;
            state.notas[index].redId = redId;
        }
    } else {
        state.notas.push({ id: 'n_' + Date.now() + Math.random(), texto: txt, redId });
    }

    saveData();
    closeModal('modal-nota');
    renderNotas();
});

// Import / Export
document.getElementById('btn-export').addEventListener('click', () => {
    const container = document.getElementById('export-networks-container');
    container.innerHTML = '';
    if (!state.redes || state.redes.length === 0) {
        alert("No hay redes para exportar.");
        return;
    }

    state.redes.forEach(red => {
        const label = document.createElement('label');
        label.style.display = 'flex';
        label.style.alignItems = 'center';
        label.style.gap = '8px';
        label.style.cursor = 'pointer';
        label.style.padding = '5px 0';
        label.innerHTML = `
            <input type="checkbox" class="export-network-checkbox" value="${red.id}" checked>
            <span>${red.nombre} <small style="color:gray;">${red.domain ? '(' + red.domain + ')' : ''}</small></span>
        `;
        container.appendChild(label);
    });

    document.getElementById('modal-export').classList.add('active');
});

document.getElementById('form-export')?.addEventListener('submit', (e) => {
    e.preventDefault();

    const selectedCheckboxes = Array.from(document.querySelectorAll('.export-network-checkbox:checked'));
    if (selectedCheckboxes.length === 0) {
        alert("Debes seleccionar al menos una red para exportar.");
        return;
    }

    const selectedNetworkIds = selectedCheckboxes.map(cb => cb.value);

    // Generar estado parcial filtrado
    const selectedRedes = state.redes.filter(r => selectedNetworkIds.includes(r.id));
    const selectedHosts = state.hosts.filter(h => selectedNetworkIds.includes(h.redId));
    const selectedNotas = state.notas.filter(n => selectedNetworkIds.includes(n.redId));

    // Crear objeto de exportación conservando configuraciones globales si las hay
    const exportData = {
        ...state,
        activeRedId: selectedNetworkIds.length > 0 ? selectedNetworkIds[0] : state.activeRedId,
        redes: selectedRedes,
        hosts: selectedHosts,
        notas: selectedNotas
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;

    // Construir nombre de archivo
    const networkNames = selectedRedes.map(r => r.nombre.replace(/[^a-z0-9]/gi, '_').toLowerCase()).join('-');
    const filenamePrefix = networkNames.length > 50 ? networkNames.substring(0, 50) + '_' : networkNames + '_';

    a.download = `facilitator_${filenamePrefix}config_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);

    closeModal('modal-export');
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
                populateNetworkSelects();
                renderActiveNetworkSelect();
                updateHeaderDomain();
                renderHosts();
                renderNotas();
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
    renderNetworks();
    document.getElementById('modal-settings').classList.add('active');
});

function updateHeaderDomain() {
    const display = document.getElementById('header-domain-display');
    const currentRed = state.redes ? state.redes.find(r => r.id === state.activeRedId) : null;
    if (currentRed && currentRed.domain && currentRed.domain.trim() !== '') {
        display.textContent = `- ${currentRed.domain}`;
        document.title = `${currentRed.domain} - Facilitator`;
    } else {
        display.textContent = '';
        document.title = 'Facilitator';
    }
}



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
populateNetworkSelects();
renderActiveNetworkSelect();
updateHeaderDomain();
renderHosts();
renderNotas();

// Inyectar versión en el footer
const footerVersion = document.getElementById('footer-version');
if (footerVersion) footerVersion.textContent = `Versión ${APP_VERSION} | Agustin Ivorra`;



function renderNetworks() {
    const container = document.getElementById('networks-container');
    if (!container) return;
    container.innerHTML = '';

    if (!state.redes) state.redes = [];

    state.redes.forEach(red => {
        const div = document.createElement('div');
        div.className = 'item-wrapper';
        div.style.display = 'flex';
        div.style.justifyContent = 'space-between';
        div.style.alignItems = 'center';
        div.style.padding = '10px';
        div.style.border = '1px solid var(--border-color)';
        div.style.borderRadius = '4px';
        div.style.background = 'var(--bg-secondary)';

        div.innerHTML = `
            <div>
                <strong style="display:block;">${red.nombre}</strong>
                <small style="color:gray;">${red.domain ? 'Dominio: ' + red.domain : 'Sin Dominio'}</small>
            </div>
            <div style="display:flex; gap: 8px;">
                <button type="button" class="btn btn-secondary btn-sm" onclick="editNetwork('${red.id}')"><i data-lucide="pencil" class="icon-sm"></i></button>
                <button type="button" class="btn btn-danger btn-sm" onclick="promptDeleteNetwork('${red.id}')"><i data-lucide="trash-2" class="icon-sm"></i></button>
            </div>
        `;
        container.appendChild(div);
    });
    if (window.lucide) lucide.createIcons();
}

window.openNetworkForm = function () {
    document.getElementById('form-network').reset();
    document.getElementById('network-id').value = '';
    document.getElementById('modal-network-title').textContent = 'Añadir Red';
    document.getElementById('modal-network-form').classList.add('active');
};

window.editNetwork = function (id) {
    const red = state.redes.find(r => r.id === id);
    if (!red) return;
    document.getElementById('network-id').value = red.id;
    document.getElementById('network-name').value = red.nombre;
    document.getElementById('network-domain').value = red.domain || '';
    document.getElementById('modal-network-title').textContent = 'Editar Red';
    document.getElementById('modal-network-form').classList.add('active');
};

let currentDeleteNetworkId = null;

window.promptDeleteNetwork = function (id) {
    const red = state.redes.find(r => r.id === id);
    if (!red) return;

    // Validar si es la única red
    if (state.redes.length <= 1) {
        alert("No puedes eliminar la única red existente. Por favor, crea una nueva red primero.");
        return;
    }

    currentDeleteNetworkId = red.id;
    document.getElementById('delete-network-name-display').textContent = red.nombre;
    document.getElementById('delete-network-name-expected').value = red.nombre;
    document.getElementById('delete-network-confirm').value = '';
    document.getElementById('btn-confirm-delete').disabled = true;

    document.getElementById('modal-delete-network').classList.add('active');
};

document.getElementById('delete-network-confirm')?.addEventListener('input', (e) => {
    const expected = document.getElementById('delete-network-name-expected').value;
    document.getElementById('btn-confirm-delete').disabled = (e.target.value !== expected);
});

document.getElementById('form-delete-network')?.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!currentDeleteNetworkId) return;

    const expected = document.getElementById('delete-network-name-expected').value;
    const confirms = document.getElementById('delete-network-confirm').value;

    if (expected !== confirms) return;

    // Ejecutar el borrado en cascada
    state.redes = state.redes.filter(r => r.id !== currentDeleteNetworkId);
    state.hosts = state.hosts.filter(h => h.redId !== currentDeleteNetworkId);
    state.notas = state.notas.filter(n => n.redId !== currentDeleteNetworkId);

    // Si borramos la red activa actual, pivotamos a otra.
    if (state.activeRedId === currentDeleteNetworkId) {
        state.activeRedId = state.redes[0].id;
        selectedHost = null;
        selectedService = null;
    }

    currentDeleteNetworkId = null;
    saveData();
    closeModal('modal-delete-network');
    renderNetworks();
    populateNetworkSelects();
    renderActiveNetworkSelect();
    applyActiveNetworkState();
});

document.getElementById('form-network')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('network-id').value;
    const nombre = document.getElementById('network-name').value.trim();
    const domain = document.getElementById('network-domain').value.trim();

    if (!nombre) return;

    if (id) {
        const index = state.redes.findIndex(r => r.id === id);
        if (index > -1) {
            state.redes[index].nombre = nombre;
            state.redes[index].domain = domain;
        }
    } else {
        const newRed = { id: 'red_' + Date.now(), nombre, domain };
        state.redes.push(newRed);
    }

    saveData();
    closeModal('modal-network-form');
    renderNetworks();
    populateNetworkSelects();
    renderActiveNetworkSelect();
    applyActiveNetworkState();
});

function renderActiveNetworkSelect() {
    const select = document.getElementById('active-network-select');
    if (!select) return;
    select.innerHTML = '';

    if (!state.redes) return;

    state.redes.forEach(red => {
        const opt = document.createElement('option');
        opt.value = red.id;
        opt.textContent = red.nombre;
        if (red.id === state.activeRedId) opt.selected = true;
        select.appendChild(opt);
    });
}

function populateNetworkSelects() {
    ['host-red', 'nota-red'].forEach(selectId => {
        const select = document.getElementById(selectId);
        if (!select) return;
        const currentVal = select.value;
        select.innerHTML = '';
        state.redes.forEach((red, idx) => {
            const opt = document.createElement('option');
            opt.value = red.id;
            opt.textContent = red.nombre;
            // Si hay un valor, mantenlo. Si no, selecciona la red activa por defecto.
            if ((currentVal && currentVal === red.id) || (!currentVal && state.activeRedId === red.id)) {
                opt.selected = true;
            }
            select.appendChild(opt);
        });
    });
}

document.getElementById('active-network-select')?.addEventListener('change', (e) => {
    state.activeRedId = e.target.value;
    selectedHost = null;
    selectedService = null;
    saveData();
    applyActiveNetworkState();
});

function applyActiveNetworkState() {
    actualizarUrl();
    updateHeaderDomain();
    renderHosts(document.getElementById('buscador').value);
    renderNotas();
    if (selectedHost) {
        renderServices();
    } else {
        document.getElementById('modal-services-selection').classList.remove('active');
    }
}

// ── Update Check ─────────────────────────────────────────────────────────────
function parseVersion(v) {
    // Elimina prefijos como "v" (ej: "v2.3" → [2,3])
    return String(v).replace(/^v/i, '').split('.').map(Number);
}

function isNewer(remote, local) {
    const r = parseVersion(remote);
    const l = parseVersion(local);
    for (let i = 0; i < Math.max(r.length, l.length); i++) {
        const rv = r[i] ?? 0;
        const lv = l[i] ?? 0;
        if (rv > lv) return true;
        if (rv < lv) return false;
    }
    return false;
}

async function checkForUpdates() {
    try {
        const res = await fetch(
            `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
            { headers: { Accept: 'application/vnd.github+json' }, cache: 'no-store' }
        );
        if (!res.ok) return;
        const data = await res.json();
        const remoteTag = data.tag_name || '';
        if (!remoteTag || !isNewer(remoteTag, APP_VERSION)) return;

        // Mostrar banner de actualización debajo del texto de versión
        const footerP = document.querySelector('.app-footer p');
        if (!footerP) return;
        const footerEl = footerP.parentElement;

        const banner = document.createElement('a');
        banner.id = 'update-banner';
        banner.href = data.html_url;
        banner.target = '_blank';
        banner.rel = 'noopener noreferrer';
        banner.title = `Ver ${remoteTag} en GitHub`;
        banner.innerHTML = `<i data-lucide="arrow-up-circle" class="icon-sm" style="vertical-align:middle;"></i>&nbsp;Nueva versión disponible: ${remoteTag}`;
        banner.style.cssText = [
            'display:inline-flex',
            'align-items:center',
            'gap:5px',
            'padding:3px 10px',
            'border-radius:20px',
            'font-size:12px',
            'font-weight:600',
            'text-decoration:none',
            'color:#fff',
            'background:linear-gradient(135deg,#3b82f6,#6366f1)',
            'box-shadow:0 2px 8px rgba(99,102,241,0.4)',
            'animation:pulse-badge 2s ease-in-out infinite'
        ].join(';');

        footerEl.insertBefore(banner, footerP);
        if (window.lucide) lucide.createIcons();
    } catch (_) {
        // Falla en silencio — sin conexión o repo no existente
    }
}

// Inyectar keyframe de pulso
(function injectUpdateStyles() {
    if (document.getElementById('update-check-styles')) return;
    const style = document.createElement('style');
    style.id = 'update-check-styles';
    style.textContent = `
        @keyframes pulse-badge {
            0%, 100% { box-shadow: 0 2px 8px rgba(99,102,241,0.4); }
            50%        { box-shadow: 0 2px 16px rgba(99,102,241,0.75); }
        }
    `;
    document.head.appendChild(style);
})();

checkForUpdates();
