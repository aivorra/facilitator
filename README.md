# Facilitator

**Facilitator** es un dashboard administrativo ligero y portátil diseñado para centralizar y agilizar el acceso a diferentes recursos de red, servidores y servicios web. Funciona como un "hub" dinámico que permite a los administradores de sistemas y operadores de red organizar, documentar y acceder en un solo clic a la infraestructura tecnológica y plataformas de monitoreo.

## 🚀 Características Principales

*   **Gestión Centralizada de Hosts:** Organiza tus recursos en diferentes categorías (*Applications, Servers, Networking, Base Stations*).
*   **Servicios Multi-Host:** A diferencia de un simple marcador de URLs, cada Host puede tener configurados múltiples servicios internos de forma granular (selección de protocolo HTTP/HTTPS, nombres personalizados y puertos específicos).
*   **Modo Edición Integrado:** Interfaz intuitiva para añadir, editar o eliminar hosts y servicios directamente desde la web, sin tocar código.
*   **Panel de Notas (Drag & Drop):** Una barra lateral flotante para guardar recordatorios, credenciales genéricas o información crítica. Las notas aceptan etiquetas HTML ligeras y pueden reordenarse fácilmente arrastrándolas.
*   **Alta Portabilidad (Local Storage):** No requiere un backend ni base de datos. Absolutamente toda la configuración (hosts, servicios, notas y preferencias) se guarda de manera persistente en tu navegador usando `localStorage`.
*   **Importación y Exportación JSON:** ¿Cambias de computadora o quieres compartir tu infraestructura con un compañero? Puedes exportar toda tu configuración en un archivo JSON e importarla en otro navegador al instante.
*   **Resolución de Dominio Dinámica:** Permite establecer un "Dominio Global" por defecto (ej. `.tuempresa.local`) que se adjunta automáticamente a los hosts, resolviendo las URLs de manera inteligente.
*   **Buscador en Tiempo Real:** Filtra instantáneamente entre decenas de hosts usando la barra de búsqueda superior.
*   **Modo Oscuro (Dark Mode):** Soporte nativo para alternar entre temas claro u oscuro, asegurando comodidad visual.

## 🛠️ Tecnologías Utilizadas

Este proyecto destaca por su simplicidad técnica, manteniéndose puramente en el ecosistema Frontend:

*   **HTML5 & CSS3 (Vanilla):** Estilos limpios y modernos, uso de variables nativas (Custom Properties) y diseño responsivo.
*   **JavaScript (ES6+):** Toda la lógica de la aplicación, manipulación del DOM, Drag & Drop y manejo stateful, escrito en JavaScript puro sin frameworks.
*   **Lucide Icons:** Iconografía moderna y consistente a lo largo de toda la interfaz.

## 💻 Instalación y Uso

Dado que es una aplicación web estática (Serverless Frontend), no necesitas compilar nada ni instalar dependencias pesadas:

1.  Clona el repositorio:
    ```bash
    git clone https://github.com/tu-usuario/quetool.git
    ```
2.  Abre el archivo `index.html` de la carpeta `facilitator` en tu navegador web moderno favorito (Chrome, Firefox, Edge, Safari).
3.  ¡Empezá a configurar tus hosts desde **Modo Edición** (ícono de lápiz en la barra superior).

## 🗂️ Estructura de Datos (Exportaciones)

Cuando exportas una configuración, obtendrás un archivo `.json` que contiene tu estado global, el cual sigue esta estructura semántica:
*   `hosts`: Array de objetos que contienen nombre, IP/Hostname, Categoría y sus `servicios` internos (Array de puertos y nombres de servicios).
*   `notas`: Array de objetos para las notas de la barra lateral.
*   `domain`: La variable del dominio local por defecto.
*   `darkMode`: Tu preferencia visual.
