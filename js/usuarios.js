/*=========================================================
    CREDICONTROL
    usuarios.js
    GESTION DE USUARIOS Y SESIONES
=========================================================*/


/*=========================================================
    INICIALIZAR SISTEMA DE USUARIOS
=========================================================*/

function inicializarUsuarios(){

    if(!Array.isArray(DB.usuarios)){

        DB.usuarios = [];

    }


    /*
        IMPORTANTE:

        Ya no se crea automáticamente
        el usuario admin / admin123.

        Si no existen usuarios, la aplicación
        esperará a que la empresa sea activada
        y posteriormente solicitará la creación
        del administrador principal.
    */

    if(DB.usuarios.length === 0){

        console.log(
            "Esta instalación todavía no tiene administrador local."
        );

        return false;

    }


    return true;

}


/*=========================================================
    OBTENER USUARIO
=========================================================*/

function obtenerUsuario(id){

    return DB.usuarios.find(

        usuario =>
            Number(usuario.id) ===
            Number(id)

    );

}


/*=========================================================
    BUSCAR USUARIO POR NOMBRE DE USUARIO
=========================================================*/

function buscarUsuarioPorLogin(login){

    return DB.usuarios.find(

        usuario =>
            usuario.usuario
                .toLowerCase() ===
            login.toLowerCase()

    );

}


/*=========================================================
    OBTENER USUARIO ACTUAL
=========================================================*/

function obtenerUsuarioActual(){

    if(!DB.sesion){

        return null;

    }


    return obtenerUsuario(
        DB.sesion.usuarioId
    );

}


/*=========================================================
    VERIFICAR ROL
=========================================================*/

function usuarioTieneRol(rol){

    const usuario =
        obtenerUsuarioActual();


    if(!usuario){

        return false;

    }


    return usuario.rol === rol;

}


/*=========================================================
    VERIFICAR ADMINISTRADOR
=========================================================*/

function esAdministrador(){

    return usuarioTieneRol(
        "ADMINISTRADOR"
    );

}

/*=========================================================
    SEGURIDAD DE CONTRASEÑAS
    PBKDF2 + SALT
=========================================================*/

function bufferAHex(buffer){

    return Array
        .from(new Uint8Array(buffer))
        .map(byte =>
            byte
                .toString(16)
                .padStart(2, "0")
        )
        .join("");

}


function hexABuffer(hex){

    const bytes =
        new Uint8Array(
            hex.length / 2
        );


    for(
        let i = 0;
        i < bytes.length;
        i++
    ){

        bytes[i] =
            parseInt(
                hex.substr(
                    i * 2,
                    2
                ),
                16
            );

    }


    return bytes;

}


/*=========================================================
    CREAR HASH DE CONTRASEÑA
=========================================================*/

async function crearHashPassword(password){

    const encoder =
        new TextEncoder();


    /* CREAR SALT ALEATORIO */

    const salt =
        crypto.getRandomValues(
            new Uint8Array(16)
        );


    /* IMPORTAR CONTRASEÑA */

    const keyMaterial =
        await crypto.subtle.importKey(

            "raw",

            encoder.encode(password),

            "PBKDF2",

            false,

            ["deriveBits"]

        );


    /* GENERAR HASH */

    const hash =
        await crypto.subtle.deriveBits(

            {
                name: "PBKDF2",

                salt: salt,

                iterations: 210000,

                hash: "SHA-256"
            },

            keyMaterial,

            256

        );


    return {

        hash:
            bufferAHex(hash),

        salt:
            bufferAHex(salt),

        algoritmo:
            "PBKDF2-SHA256",

        iteraciones:
            210000

    };

}


/*=========================================================
    VERIFICAR CONTRASEÑA
=========================================================*/

async function verificarPassword(
    password,
    usuario
){

    /*
        USUARIO CON NUEVO SISTEMA
    */

    if(
        usuario.passwordHash &&
        usuario.passwordSalt
    ){

        const encoder =
            new TextEncoder();


        const keyMaterial =
            await crypto.subtle.importKey(

                "raw",

                encoder.encode(password),

                "PBKDF2",

                false,

                ["deriveBits"]

            );


        const hash =
            await crypto.subtle.deriveBits(

            {
                name: "PBKDF2",

                salt:
                    hexABuffer(
                        usuario.passwordSalt
                    ),

                iterations:
                    Number(
                        usuario.passwordIteraciones ||
                        210000
                    ),

                hash:
                    "SHA-256"
            },

            keyMaterial,

            256

        );


        return (
            bufferAHex(hash) ===
            usuario.passwordHash
        );

    }


    /*
        COMPATIBILIDAD TEMPORAL

        Permite iniciar sesión a usuarios antiguos
        que todavía utilizan passwordTemporal.
    */

    if(usuario.passwordTemporal){

        return (
            usuario.passwordTemporal ===
            password
        );

    }


    return false;

}

/*=========================================================
    INICIAR SESION
    CON VERIFICACION SEGURA DE CONTRASEÑA
=========================================================*/

async function iniciarSesion(){

    const login =
        document
            .getElementById("loginUsuario")
            .value
            .trim();


    const password =
        document
            .getElementById("loginPassword")
            .value;


    const mensaje =
        document.getElementById(
            "mensajeLogin"
        );


    mensaje.classList.add(
        "d-none"
    );


    /* VALIDAR CAMPOS */

    if(!login || !password){

        mensaje.innerHTML =
            "Ingrese usuario y contraseña.";

        mensaje.classList.remove(
            "d-none"
        );

        return;

    }


    /* BUSCAR USUARIO */

    const usuario =
        buscarUsuarioPorLogin(login);


    if(!usuario){

        mensaje.innerHTML =
            "Usuario o contraseña incorrectos.";

        mensaje.classList.remove(
            "d-none"
        );

        return;

    }


    /* VALIDAR ESTADO */

    if(usuario.estado !== "ACTIVO"){

        mensaje.innerHTML =
            "Este usuario se encuentra inactivo.";

        mensaje.classList.remove(
            "d-none"
        );

        return;

    }


    /*=====================================================
        VERIFICAR CONTRASEÑA
    =====================================================*/

    let passwordCorrecta = false;


    try{

        passwordCorrecta =
            await verificarPassword(
                password,
                usuario
            );

    }catch(error){

        console.error(
            "Error verificando contraseña:",
            error
        );

        mensaje.innerHTML =
            "No fue posible validar las credenciales.";

        mensaje.classList.remove(
            "d-none"
        );

        return;

    }


    if(!passwordCorrecta){

        mensaje.innerHTML =
            "Usuario o contraseña incorrectos.";

        mensaje.classList.remove(
            "d-none"
        );

        return;

    }


    /*=====================================================
        MIGRAR CONTRASEÑA ANTIGUA A HASH
    =====================================================*/

    if(
        usuario.passwordTemporal &&
        !usuario.passwordHash
    ){

        try{

            const seguridad =
                await crearHashPassword(
                    password
                );


            usuario.passwordHash =
                seguridad.hash;


            usuario.passwordSalt =
                seguridad.salt;


            usuario.passwordAlgoritmo =
                seguridad.algoritmo;


            usuario.passwordIteraciones =
                seguridad.iteraciones;


            /*
                ELIMINAR CONTRASEÑA EN TEXTO PLANO
            */

            delete usuario.passwordTemporal;


            DB.guardar();


            console.log(
                "Contraseña migrada al sistema seguro."
            );


        }catch(error){

            console.error(
                "Error migrando contraseña:",
                error
            );


            /*
                NO BLOQUEAMOS EL LOGIN.

                La contraseña fue validada correctamente
                con el sistema anterior, pero la migración
                podrá intentarse en el próximo acceso.
            */

        }

    }


    /*=====================================================
        CREAR SESION LOCAL
    =====================================================*/

    DB.sesion = {

        usuarioId:
            usuario.id,

        inicio:
            new Date()
                .toISOString()

    };


    localStorage.setItem(

        STORAGE.SESION,

        JSON.stringify(
            DB.sesion
        )

    );


    /* REGISTRAR ULTIMO ACCESO */

    usuario.ultimoAcceso =
        new Date()
            .toISOString();


    DB.guardar();


    /* MOSTRAR APLICACION */

    mostrarAplicacion();

}

/*=========================================================
    CAMBIAR CREDENCIALES DEL ADMINISTRADOR PRINCIPAL
=========================================================*/

async function cambiarCredencialesAdministrador(){

    /* VALIDAR QUE SEA ADMINISTRADOR */

    if(!esAdministrador()){

        alert(
            "No tiene permisos para cambiar las credenciales."
        );

        return false;

    }


    const usuarioActual =
        obtenerUsuarioActual();


    if(!usuarioActual){

        alert(
            "No se encontró el usuario administrador."
        );

        return false;

    }


    /* SOLICITAR NUEVO USUARIO */

    const nuevoLogin =
        prompt(
            "Ingrese el nuevo nombre de usuario:",
            usuarioActual.usuario
        );


    if(
        nuevoLogin === null
    ){

        return false;

    }


    const loginLimpio =
        nuevoLogin.trim();


    if(
        loginLimpio.length < 4
    ){

        alert(
            "El nombre de usuario debe tener mínimo 4 caracteres."
        );

        return false;

    }


    /* VALIDAR QUE NO EXISTA OTRO USUARIO */

    const usuarioDuplicado =
        DB.usuarios.some(

            usuario =>

                Number(usuario.id) !==
                Number(usuarioActual.id)

                &&

                usuario.usuario
                    .toLowerCase() ===
                loginLimpio
                    .toLowerCase()

        );


    if(usuarioDuplicado){

        alert(
            "Ese nombre de usuario ya está registrado."
        );

        return false;

    }


    /* SOLICITAR NUEVA CONTRASEÑA */

    const nuevaPassword =
        prompt(
            "Ingrese la nueva contraseña:"
        );


    if(
        nuevaPassword === null
    ){

        return false;

    }


    if(
        nuevaPassword.length < 6
    ){

        alert(
            "La contraseña debe tener mínimo 6 caracteres."
        );

        return false;

    }


    /* CONFIRMAR CONTRASEÑA */

    const confirmarPassword =
        prompt(
            "Confirme la nueva contraseña:"
        );


    if(
        nuevaPassword !==
        confirmarPassword
    ){

        alert(
            "Las contraseñas no coinciden."
        );

        return false;

    }


/*=========================================================
    GENERAR NUEVA CONTRASEÑA SEGURA
=========================================================*/

let seguridad;

try{

    seguridad =
        await crearHashPassword(
            nuevaPassword
        );

}catch(error){

    console.error(
        "Error protegiendo nueva contraseña:",
        error
    );

    alert(
        "No fue posible actualizar la contraseña."
    );

    return false;

}


/*=========================================================
    ACTUALIZAR CREDENCIALES
=========================================================*/

usuarioActual.usuario =
    loginLimpio;


usuarioActual.passwordHash =
    seguridad.hash;


usuarioActual.passwordSalt =
    seguridad.salt;


usuarioActual.passwordAlgoritmo =
    seguridad.algoritmo;


usuarioActual.passwordIteraciones =
    seguridad.iteraciones;


/*
    ELIMINAR CUALQUIER CONTRASEÑA ANTIGUA
    EN TEXTO PLANO
*/

delete usuarioActual.passwordTemporal;


DB.guardar();


    alert(
        "Credenciales actualizadas correctamente.\n\n" +
        "Por seguridad debe iniciar sesión nuevamente."
    );


    /* CERRAR SESION LOCAL */

    cerrarSesion();


    return true;

}


/*=========================================================
    CERRAR SESION
=========================================================*/

function cerrarSesion(){

    DB.sesion = null;


    localStorage.removeItem(
        STORAGE.SESION
    );


    location.reload();

}


/*=========================================================
    INICIALIZAR
=========================================================*/
/*=========================================================
    CONTROL DE PANTALLA LOGIN
=========================================================*/

function mostrarLogin(){

    const login =
        document.getElementById("pantallaLogin");

    const app =
        document.querySelector(".wrapper");

    if(login){

        login.classList.remove("d-none");

    }

    if(app){

        app.style.display = "none";

    }

}


function mostrarAplicacion(){

    const login =
        document.getElementById("pantallaLogin");

    const app =
        document.querySelector(".wrapper");

    if(login){

        login.classList.add("d-none");

    }

    if(app){

        app.style.display = "flex";

    }
    
    mostrarUsuarioActivo();

    aplicarPermisosUsuario();
}
/*=========================================================
    MODAL USUARIOS
=========================================================*/

let modalUsuario;


/*=========================================================
    ABRIR MODAL NUEVO USUARIO
=========================================================*/

function abrirModalUsuario(){

    if(!esAdministrador()){

        alert(
            "No tiene permisos para administrar usuarios."
        );

        return;

    }

    document.getElementById("usuarioNombre").value = "";

    document.getElementById("usuarioLogin").value = "";

    document.getElementById("usuarioPassword").value = "";

    document.getElementById("usuarioRol").value = "COBRADOR";


    if(!modalUsuario){

        modalUsuario = new bootstrap.Modal(

            document.getElementById("modalUsuario")

        );

    }


    modalUsuario.show();

}

/*=========================================================
    CONTROL DE LICENCIAS DE COBRADORES
=========================================================*/


/* OBTENER CUPOS AUTORIZADOS */

function obtenerCuposCobradores(){

    if(
        !DB.config ||
        !DB.config.licencia
    ){

        return 0;

    }

    return Number(
        DB.config.licencia.cuposCobradores || 0
    );

}


/* CONTAR COBRADORES ACTIVOS */
async function contarCobradoresActivos(){

    const empresaId =
        obtenerEmpresaIdClientes();

    if(!empresaId){

        return 0;

    }

    try{

        const {
            data,
            error
        } =
        await supabaseClient
            .from("usuarios_empresa")
            .select("id")
            .eq(
                "empresa_id",
                empresaId
            )
            .eq(
                "rol",
                "COBRADOR"
            )
            .eq(
                "estado",
                "ACTIVO"
            );

        if(error){

            console.error(
                "Error contando cobradores activos:",
                error
            );

            return 0;

        }

        return data?.length || 0;

    }catch(error){

        console.error(
            "Error inesperado contando cobradores:",
            error
        );

        return 0;

    }

}


/* OBTENER CUPOS DISPONIBLES */


async function obtenerCuposDisponibles(){

    const cobradoresActivos =
        await contarCobradoresActivos();


    return Math.max(

        0,

        obtenerCuposCobradores() -
        cobradoresActivos

    );

}


/* VALIDAR SI HAY CUPO */

async function hayCupoParaCobrador(){

    const cuposDisponibles =
        await obtenerCuposDisponibles();

    return cuposDisponibles > 0;

}
/*=========================================================
    GUARDAR NUEVO USUARIO
=========================================================*/

async function guardarUsuario(){

    if(!esAdministrador()){

        alert(
            "No tiene permisos para crear usuarios."
        );

        return;

    }


    const nombre =
        document
            .getElementById("usuarioNombre")
            .value
            .trim();


    const login =
        document
            .getElementById("usuarioLogin")
            .value
            .trim();


    const password =
        document
            .getElementById("usuarioPassword")
            .value;


    const rol =
        document
            .getElementById("usuarioRol")
            .value;

            /*=========================================================
    VALIDAR LICENCIA DE COBRADORES
=========================================================*/

if(
    rol === "COBRADOR" &&
    !(await hayCupoParaCobrador())
){

    alert(

        "No hay cupos disponibles para crear otro cobrador.\n\n" +

        "Cupos autorizados: " +
        obtenerCuposCobradores() +

        "\nCobradores activos: " +
        await contarCobradoresActivos() +

        "\n\nSolicite la habilitación de un nuevo cupo."

    );

    return;

}


    /* VALIDACIONES */

    if(!nombre){

        alert(
            "Ingrese el nombre del usuario."
        );

        return;

    }


    if(!login){

        alert(
            "Ingrese un usuario de acceso."
        );

        return;

    }


    if(password.length < 6){

        alert(
            "La contraseña debe tener mínimo 6 caracteres."
        );

        return;

    }


    /* VERIFICAR USUARIO DUPLICADO */

    const existe =
        DB.usuarios.some(

            usuario =>

                usuario.usuario
                    .toLowerCase()

                ===

                login.toLowerCase()

        );


    if(existe){

        alert(
            "El nombre de usuario ya se encuentra registrado."
        );

        return;

    }


   /*=========================================================
    GENERAR CONTRASEÑA SEGURA
=========================================================*/

let seguridad;

try{

    seguridad =
        await crearHashPassword(
            password
        );

}catch(error){

    console.error(
        "Error protegiendo contraseña:",
        error
    );

    alert(
        "No fue posible proteger la contraseña del usuario."
    );

    return;

}


/*=========================================================
    CREAR USUARIO
=========================================================*/

const nuevoUsuario = {

    id:
        Date.now(),

    nombre:
        nombre,

    usuario:
        login,

    passwordHash:
        seguridad.hash,

    passwordSalt:
        seguridad.salt,

    passwordAlgoritmo:
        seguridad.algoritmo,

    passwordIteraciones:
        seguridad.iteraciones,

    rol:
        rol,

    estado:
        "ACTIVO",

    fechaCreacion:
        new Date()
            .toISOString(),

    ultimoAcceso:
        null

};
    DB.usuarios.push(
        nuevoUsuario
    );

   /*=========================================================
    CREAR RELACION USUARIO - EMPRESA
=========================================================*/

if(
    rol === "COBRADOR"
){

    const empresaId =
        obtenerEmpresaIdClientes();


    const usuarioEmpresa = {

        id:
            Date.now(),

        usuario_id:
            nuevoUsuario.id,

        empresa_id:
            empresaId,

        nombre:
            nuevoUsuario.nombre,

        correo:
            nuevoUsuario.usuario,

        rol:
            nuevoUsuario.rol,

        estado:
            "ACTIVO"

    };


    /*=========================================================
        GUARDAR RELACION LOCAL
    =========================================================*/

    DB.usuariosEmpresa.push(
        usuarioEmpresa
    );


    /*=========================================================
        GUARDAR USUARIO EMPRESA EN SUPABASE
    =========================================================*/

    try{

        console.log(
            "INTENTANDO CREAR USUARIO EMPRESA:",
            {
                usuario_id:
                    nuevoUsuario.id,

                nombre:
                    nuevoUsuario.nombre,

                rol:
                    nuevoUsuario.rol,

                empresaId:
                    empresaId
            }
        );


        const {
            data,
            error
        } =
        await supabaseClient
            .from("usuarios_empresa")
            .insert({

                usuario_id:
                    nuevoUsuario.id,

                empresa_id:
                    empresaId,

                nombre:
                    nuevoUsuario.nombre,

                correo:
                    nuevoUsuario.usuario,

                rol:
                    nuevoUsuario.rol,

                estado:
                    "ACTIVO"

            })
            .select()
            .single();


        if(error){

            console.error(
                "Error creando usuario empresa en Supabase:",
                error
            );

        }else{

            console.log(
                "Usuario empresa creado correctamente en Supabase:",
                data
            );

        }


    }catch(error){

        console.error(
            "Error inesperado creando usuario empresa:",
            error
        );

    }

}

    


    DB.guardar();


    /* ACTUALIZAR TABLA */

    listarUsuarios();


    /* CERRAR MODAL */

    if(modalUsuario){

        modalUsuario.hide();

    }


    alert(
        "Usuario creado correctamente."
    );

}


/*=========================================================
    LISTAR USUARIOS
=========================================================*/

function listarUsuarios(){

    const tabla =
        document.getElementById(
            "tablaUsuarios"
        );


    if(!tabla){

        return;

    }


    tabla.innerHTML = "";


    DB.usuarios.forEach(usuario=>{


        let ultimoAcceso =
            "Nunca";


        if(usuario.ultimoAcceso){

            try{

                ultimoAcceso =
                    new Date(
                        usuario.ultimoAcceso
                    ).toLocaleString();

            }catch(error){

                ultimoAcceso =
                    usuario.ultimoAcceso;

            }

        }


        const estadoColor =

            usuario.estado === "ACTIVO"

            ? "bg-success"

            : "bg-secondary";


        tabla.innerHTML += `

        <tr>

            <td>

                ${usuario.nombre}

            </td>


            <td>

                ${usuario.usuario}

            </td>


            <td>

                <span class="badge bg-primary">

                    ${usuario.rol}

                </span>

            </td>


            <td>

                <span class="badge ${estadoColor}">

                    ${usuario.estado}

                </span>

            </td>


            <td>

                ${ultimoAcceso}

            </td>


            <td>

                ${
                    usuario.usuario !== "admin"

                    ?

                    `
                    <button
                        class="btn btn-sm ${
                            usuario.estado === "ACTIVO"
                            ? "btn-warning"
                            : "btn-success"
                        }"
                        onclick="cambiarEstadoUsuario(${usuario.id})">

                        ${
                            usuario.estado === "ACTIVO"
                            ? "Desactivar"
                            : "Activar"
                        }

                    </button>
                    `

                    :

                    `
                    <span class="text-muted">

                        Usuario principal

                    </span>
                    `
                }

            </td>

        </tr>

        `;

    });
    
    actualizarPanelLicencias();
}


/*=========================================================
    ACTIVAR / DESACTIVAR USUARIO
=========================================================*/

function cambiarEstadoUsuario(id){

    if(!esAdministrador()){

        alert(
            "No tiene permisos para realizar esta operación."
        );

        return;

    }


    const usuario =
        obtenerUsuario(id);


    if(!usuario){

        alert(
            "No se encontró el usuario."
        );

        return;

    }


    /*
        PROTEGER ADMINISTRADOR PRINCIPAL
    */

    if(usuario.usuario === "ADMINISTRADOR"){

        alert(
            "El administrador principal no puede ser desactivado."
        );

        return;

    }


    const nuevoEstado =

        usuario.estado === "ACTIVO"

        ? "INACTIVO"

        : "ACTIVO";


    const confirmar =
        confirm(

            "¿Desea " +

            (
                nuevoEstado === "ACTIVO"
                ? "activar"
                : "desactivar"
            )

            + " al usuario " +

            usuario.nombre +

            "?"

        );


    if(!confirmar){

        return;

    }


    usuario.estado =
        nuevoEstado;


    DB.guardar();


    listarUsuarios();

}

/*=========================================================
    APLICAR PERMISOS SEGUN ROL
=========================================================*/

function aplicarPermisosUsuario(){

    const usuario =
        obtenerUsuarioActual();

    if(!usuario){

        return;

    }


    /* ELEMENTOS DEL MENU */

    const menuReportes =
        document.querySelector(
            '[data-page="reportes"]'
        );

    const menuUsuarios =
        document.getElementById(
            "menuUsuarios"
        );

    const menuConfiguracion =
        document.querySelector(
            '[data-page="configuracion"]'
        );


    /* BOTON NUEVO PRESTAMO */

    const btnNuevoPrestamo =
        document.getElementById(
            "btnNuevoPrestamo"
        );

    const btnNuevoPrestamoTop =
        document.getElementById(
            "btnNuevoPrestamoTop"
        );


    /*=============================================
        ADMINISTRADOR
    =============================================*/

    if(usuario.rol === "ADMINISTRADOR"){

        if(menuReportes){

            menuReportes.style.display = "";

        }

        if(menuUsuarios){

            menuUsuarios.style.display = "";

        }

        if(menuConfiguracion){

            menuConfiguracion.style.display = "";

        }

        if(btnNuevoPrestamo){

            btnNuevoPrestamo.style.display = "";

        }

        if(btnNuevoPrestamoTop){

            btnNuevoPrestamoTop.style.display = "";

        }

        return;

    }


    /*=============================================
        COBRADOR
    =============================================*/

    if(usuario.rol === "COBRADOR"){

        /* OCULTAR MODULOS ADMINISTRATIVOS */

        if(menuReportes){

            menuReportes.style.display =
                "none";

        }

        if(menuUsuarios){

            menuUsuarios.style.display =
                "none";

        }

        if(menuConfiguracion){

            menuConfiguracion.style.display =
                "none";

        }


        /* NO PUEDE CREAR PRESTAMOS */

        if(btnNuevoPrestamo){

            btnNuevoPrestamo.style.display =
                "none";

        }

        if(btnNuevoPrestamoTop){

            btnNuevoPrestamoTop.style.display =
                "none";

        }

    }

}
document.addEventListener(
    "DOMContentLoaded",
    function(){

        inicializarUsuarios();


        const botonLogin =
            document.getElementById(
                "btnIniciarSesion"
            );


        if(botonLogin){

            botonLogin.addEventListener(
                "click",
                iniciarSesion
            );
        const botonCerrarSesion =
            document.getElementById(
                "btnCerrarSesion"
            );


        if(botonCerrarSesion){

            botonCerrarSesion.addEventListener(

                "click",

            function(){

                const confirmar =
                    confirm(
                        "¿Desea cerrar la sesión?"
                );


            if(confirmar){

                cerrarSesion();

            }

        }

    );

    const btnSolicitarCupo =
    document.getElementById(
        "btnSolicitarCupo"
    );

if(btnSolicitarCupo){

    btnSolicitarCupo.addEventListener(
        "click",
        solicitarNuevoCupo
    );

}

}

const btnNuevoUsuario =
    document.getElementById(
        "btnNuevoUsuario"
    );


if(btnNuevoUsuario){

    btnNuevoUsuario.addEventListener(

        "click",

        abrirModalUsuario

    );

}


const btnGuardarUsuario =
    document.getElementById(
        "btnGuardarUsuario"
    );


if(btnGuardarUsuario){

    btnGuardarUsuario.addEventListener(

        "click",

        guardarUsuario

    );

}

const btnCambiarCredencialesAdmin =
    document.getElementById(
        "btnCambiarCredencialesAdmin"
    );

if(btnCambiarCredencialesAdmin){

    btnCambiarCredencialesAdmin.addEventListener(

        "click",

        cambiarCredencialesAdministrador

    );

}


/* CARGAR LISTADO */

listarUsuarios();
        }


        /* PERMITIR ENTER */

        const password =
            document.getElementById(
                "loginPassword"
            );


        if(password){

            password.addEventListener(
                "keydown",
                function(event){

                    if(event.key === "Enter"){

                        iniciarSesion();

                    }

                }
            );

        }


        /* CONTROL DE SESION */

        if(DB.sesion){

            mostrarAplicacion();

        }else{

            mostrarLogin();

        }

    }
);

/*=========================================================
    MOSTRAR USUARIO ACTIVO
=========================================================*/

async function mostrarUsuarioActivo(){

        try {

            await sincronizarLicenciaCentral();

        } catch(error) {

            console.error(
                "No fue posible sincronizar la licencia:",
                error
            );

}

    const usuario =
        obtenerUsuarioActual();


    if(!usuario){

        return;

    }


    const nombre =
        document.getElementById(
            "nombreUsuarioSesion"
        );


    const rol =
        document.getElementById(
            "rolUsuarioSesion"
        );


    if(nombre){

        nombre.textContent =
            usuario.nombre;

    }


    if(rol){

        rol.textContent =
            usuario.rol;

    }
    
}

/*=========================================================
    LICENCIAS DE COBRADORES
=========================================================*/

function obtenerCuposCobradores(){

    return Number(

        DB.config?.licencia?.cuposCobradores || 0

    );

}


/*=========================================================
    CONTAR COBRADORES ACTIVOS
=========================================================*/

function contarCobradoresActivos(){

    return DB.usuarios.filter(

        usuario =>

            usuario.rol === "COBRADOR" &&

            usuario.estado === "ACTIVO"

    ).length;

}


/*=========================================================
    CUPOS DISPONIBLES
=========================================================*/

function obtenerCuposDisponibles(){

    return Math.max(

        0,

        obtenerCuposCobradores() -

        contarCobradoresActivos()

    );

}



/*=========================================================
    IDENTIFICAR EMPRESA DEL USUARIO AUTENTICADO
=========================================================*/

async function identificarEmpresaAutenticada(){

    try{

        /* OBTENER USUARIO AUTENTICADO */

        const {
            data: { user },
            error: errorUsuario
        } = await supabaseClient.auth.getUser();


        if(errorUsuario || !user){

            console.warn(
                "No hay usuario autenticado en Supabase."
            );

            return false;

        }


        console.log(
            "Usuario autenticado:",
            user.email,
            user.id
        );


        /* BUSCAR LA EMPRESA EN usuarios_empresa */

        const {
            data,
            error
        } = await supabaseClient
            .from("usuarios_empresa")
            .select(`
                empresa_id,
                estado,
                empresas(
                    id,
                    estado
                )
            `)
            .eq("auth_user_id", user.id)
            .single();


        if(error){

            console.error(
                "Error buscando empresa:",
                error
            );

            return false;

        }


        if(!data){

            console.warn(
                "El usuario no está asociado a ninguna empresa."
            );

            return false;

        }


        if(data.estado !== "ACTIVO"){

            console.warn(
                "El usuario de empresa está inactivo."
            );

            return false;

        }


        if(!data.empresa_id){

            console.warn(
                "El usuario no tiene empresa asignada."
            );

            return false;

        }


        if(
            data.empresas &&
            data.empresas.estado !== "ACTIVA"
        ){

            console.warn(
                "La empresa se encuentra inactiva."
            );

            return false;

        }


        DB.config.licencia.empresaId =
            Number(data.empresa_id);

        DB.guardar();


        console.log(
            "Empresa identificada:",
            data.empresa_id
        );

        return true;

    }catch(error){

        console.error(
            "Error identificando empresa:",
            error
        );

        return false;

    }

}

/*=========================================================
    SINCRONIZAR LICENCIA CON CREDICONTROL CENTRAL
=========================================================*/

async function sincronizarLicenciaCentral(){

    try{

        if(
            !DB.config ||
            !DB.config.licencia ||
            !DB.config.licencia.empresaId
        ){

            console.warn(
                "La instalación no tiene empresaId configurado."
            );

            return false;

        }


        const empresaId =
            DB.config.licencia.empresaId;


        const {
            data,
            error
        } =
        await supabaseClient
            .from("empresas")
            .select(
                "id,codigo_empresa,cupos_cobradores,estado"
            )
            .eq(
                "id",
                empresaId
            )
            .single();


        if(error){

            console.error(
                "Error sincronizando licencia:",
                error
            );

            return false;

        }


        if(!data){

            console.error(
                "Empresa no encontrada en BKC Central."
            );

            return false;

        }


        if(data.estado !== "ACTIVA"){

            console.warn(
                "La empresa no se encuentra activa."
            );

            return false;

        }


        DB.config.licencia.cuposCobradores =
            Number(
                data.cupos_cobradores || 0
            );


        DB.config.licencia.codigoEmpresa =
            data.codigo_empresa;


        DB.config.licencia.ultimaSincronizacion =
            new Date().toISOString();


        DB.guardar();


        actualizarPanelLicencias();


        console.log(
            "Licencia sincronizada correctamente:",
            data
        );


        return true;


    }catch(error){

        console.error(
            "Error inesperado sincronizando licencia:",
            error
        );

        return false;

    }

}


/*=========================================================
    INICIALIZAR CONEXION CON CREDICONTROL CENTRAL
=========================================================*/

async function inicializarConexionCentral(){

    try{

        console.log(
            "Iniciando conexión con BKC Central..."
        );


        /* 1. VERIFICAR SESION SUPABASE */

        const {
            data: { session },
            error: errorSesion
        } = await supabaseClient.auth.getSession();


        if(errorSesion){

            console.error(
                "Error verificando sesión central:",
                errorSesion
            );

            return false;

        }


        if(!session){

            console.warn(
                "No existe una sesión activa de ADMIN_EMPRESA."
            );

            return false;

        }


        console.log(
            "Sesión central encontrada:",
            session.user.email
        );


        /* 2. IDENTIFICAR EMPRESA */

        const empresaIdentificada =
            await identificarEmpresaAutenticada();


        if(!empresaIdentificada){

            console.warn(
                "No fue posible identificar la empresa."
            );

            return false;

        }


        /* 3. SINCRONIZAR LICENCIA */

        const licenciaSincronizada =
            await sincronizarLicenciaCentral();


        if(licenciaSincronizada === false){

            console.warn(
                "No fue posible sincronizar la licencia."
            );

            return false;

        }


        console.log(
            "BKC Central sincronizado correctamente."
        );


        return true;


    }catch(error){

        console.error(
            "Error inicializando conexión central:",
            error
        );

        return false;

    }

}

/*=========================================================
    MOSTRAR PANTALLA DE ACTIVACION
=========================================================*/

function mostrarPantallaActivacion(){

    const pantalla =
        document.getElementById(
            "pantallaActivacionEmpresa"
        );

    if(pantalla){

        pantalla.style.display = "flex";

    }

}


/*=========================================================
    OCULTAR PANTALLA DE ACTIVACION
=========================================================*/

function ocultarPantallaActivacion(){

    const pantalla =
        document.getElementById(
            "pantallaActivacionEmpresa"
        );

    if(pantalla){

        pantalla.style.display = "none";

    }

}

/*=========================================================
    MOSTRAR CREACION DE ADMINISTRADOR PRINCIPAL
=========================================================*/

function mostrarCrearAdministrador(){

    const pantalla =
        document.getElementById(
            "pantallaCrearAdministrador"
        );

    if(pantalla){

        pantalla.style.display = "flex";

    }

}


/*=========================================================
    OCULTAR CREACION DE ADMINISTRADOR PRINCIPAL
=========================================================*/

function ocultarCrearAdministrador(){

    const pantalla =
        document.getElementById(
            "pantallaCrearAdministrador"
        );

    if(pantalla){

        pantalla.style.display = "none";

    }

}


/*=========================================================
    CREAR ADMINISTRADOR PRINCIPAL
=========================================================*/

async function crearAdministradorPrincipal(){

    /*
        SOLO SE PERMITE CREAR EL ADMINISTRADOR
        SI NO EXISTEN USUARIOS
    */

    if(
        Array.isArray(DB.usuarios) &&
        DB.usuarios.length > 0
    ){

        alert(
            "Esta instalación ya tiene un administrador."
        );

        ocultarCrearAdministrador();

        return false;

    }


    const nombre =
        document
            .getElementById("nuevoAdminNombre")
            ?.value
            .trim();


    const login =
        document
            .getElementById("nuevoAdminUsuario")
            ?.value
            .trim();


    const password =
        document
            .getElementById("nuevoAdminPassword")
            ?.value;


    const confirmarPassword =
        document
            .getElementById(
                "nuevoAdminPasswordConfirmar"
            )
            ?.value;


    const mensaje =
        document.getElementById(
            "mensajeCrearAdministrador"
        );


    if(
        !nombre ||
        !login ||
        !password
    ){

        if(mensaje){

            mensaje.textContent =
                "Complete todos los campos.";

        }

        return false;

    }


    if(login.length < 4){

        if(mensaje){

            mensaje.textContent =
                "El usuario debe tener mínimo 4 caracteres.";

        }

        return false;

    }


    if(password.length < 6){

        if(mensaje){

            mensaje.textContent =
                "La contraseña debe tener mínimo 6 caracteres.";

        }

        return false;

    }


    if(
        password !==
        confirmarPassword
    ){

        if(mensaje){

            mensaje.textContent =
                "Las contraseñas no coinciden.";

        }

        return false;

    }


   /*=========================================================
    GENERAR CONTRASEÑA SEGURA
=========================================================*/

let seguridad;

try{

    seguridad =
        await crearHashPassword(
            password
        );

}catch(error){

    console.error(
        "Error protegiendo contraseña del administrador:",
        error
    );

    if(mensaje){

        mensaje.textContent =
            "No fue posible proteger la contraseña.";

    }

    return false;

}


/*=========================================================
    CREAR ADMINISTRADOR PRINCIPAL
=========================================================*/

const administrador = {

    id:
        Date.now(),

    nombre:
        nombre,

    usuario:
        login,

    passwordHash:
        seguridad.hash,

    passwordSalt:
        seguridad.salt,

    passwordAlgoritmo:
        seguridad.algoritmo,

    passwordIteraciones:
        seguridad.iteraciones,

    rol:
        "ADMINISTRADOR",

    estado:
        "ACTIVO",

    fechaCreacion:
        new Date().toISOString(),

    ultimoAcceso:
        null

};


    DB.usuarios.push(
        administrador
    );


    DB.guardar();


    console.log(
        "Administrador principal creado correctamente."
    );


    ocultarCrearAdministrador();


    alert(
        "Administrador creado correctamente.\n\n" +
        "Ya puede iniciar sesión con sus nuevas credenciales."
    );


    mostrarLogin();


    return true;

}


/*=========================================================
    ACTIVAR / VINCULAR EMPRESA
=========================================================*/

async function activarEmpresa(){

    const correo =
        document
            .getElementById("activacionCorreo")
            ?.value
            .trim();


    const password =
        document
            .getElementById("activacionPassword")
            ?.value;


    const mensaje =
        document.getElementById(
            "mensajeActivacion"
        );


    if(!correo || !password){

        if(mensaje){

            mensaje.textContent =
                "Ingrese correo y contraseña.";

        }

        return;

    }


    if(mensaje){

        mensaje.textContent =
            "Verificando empresa...";

    }


    try{

        /* INICIAR SESION EN SUPABASE */

        const {
            data,
            error
        } =
        await supabaseClient
            .auth
            .signInWithPassword({

                email: correo,

                password: password

            });


        if(error || !data.user){

            console.error(
                "Error de activación:",
                error
            );

            if(mensaje){

                mensaje.textContent =
                    "Correo o contraseña incorrectos.";

            }

            return;

        }


        /* IDENTIFICAR EMPRESA */

        const empresaCorrecta =
            await identificarEmpresaAutenticada();


        if(!empresaCorrecta){

            await supabaseClient.auth.signOut();

            if(mensaje){

                mensaje.textContent =
                    "El usuario no tiene una empresa activa asignada.";

            }

            return;

        }


        /* SINCRONIZAR LICENCIA */

        const sincronizada =
            await sincronizarLicenciaCentral();


        if(!sincronizada){

            await supabaseClient.auth.signOut();

            if(mensaje){

                mensaje.textContent =
                    "No fue posible validar la licencia de la empresa.";

            }

            return;

        }


        console.log(
            "Empresa activada correctamente."
        );


        if(mensaje){

            mensaje.textContent =
                "Empresa activada correctamente.";

        }


        ocultarPantallaActivacion();


    }catch(error){

        console.error(
            "Error inesperado activando empresa:",
            error
        );


        if(mensaje){

            mensaje.textContent =
                "Ocurrió un error durante la activación.";

        }

    }

       /*=========================================================
    VERIFICAR ADMINISTRADOR DE LA EMPRESA
=========================================================*/

try{

    const empresaId =
        Number(
            DB.config.licencia.empresaId
        );


    const {
        data: administradorEmpresa,
        error: errorAdministrador
    } =
    await supabaseClient
        .from("usuarios_empresa")
        .select(`
            id,
            usuario_id,
            nombre,
            correo,
            rol,
            estado
        `)
        .eq(
            "empresa_id",
            empresaId
        )
        .in(
            "rol",
            [
                "ADMIN",
                "ADMINISTRADOR"
            ]
        )
        .eq(
            "estado",
            "ACTIVO"
        )
        .limit(1);


    if(errorAdministrador){

        console.error(
            "Error verificando administrador de la empresa:",
            errorAdministrador
        );

        return false;

    }


    if(
        Array.isArray(administradorEmpresa) &&
        administradorEmpresa.length > 0
    ){

        console.log(
            "Administrador activo encontrado. Mostrando Login."
        );

        mostrarLogin();

    }else{

        console.log(
            "La empresa no tiene administrador activo. Mostrando creación de administrador."
        );

        mostrarCrearAdministrador();

    }

}catch(error){

    console.error(
        "Error verificando administrador:",
        error
    );

}
}

/*=========================================================
    ACTUALIZAR PANEL DE LICENCIAS
=========================================================*/

function actualizarPanelLicencias(){

    const autorizados =
        document.getElementById(
            "cuposAutorizados"
        );

    const activos =
        document.getElementById(
            "cobradoresActivos"
        );

    const disponibles =
        document.getElementById(
            "cuposDisponibles"
        );


    if(autorizados){

        autorizados.textContent =
            obtenerCuposCobradores();

    }


    if(activos){

        activos.textContent =
            contarCobradoresActivos();

    }


    if(disponibles){

        disponibles.textContent =
            obtenerCuposDisponibles();

    }

}

/*=========================================================
    SOLICITAR NUEVO CUPO A CREDICONTROL CENTRAL
=========================================================*/

async function solicitarNuevoCupo(){

    console.log(
        "Entró a solicitar nuevo cupo"
    );


    /* VALIDAR ADMINISTRADOR */

    if(!esAdministrador()){

        alert(
            "No tiene permisos para solicitar nuevos cupos."
        );

        return;

    }


    /* VALIDAR LICENCIA */

    if(
        !DB.config ||
        !DB.config.licencia ||
        !DB.config.licencia.empresaId
    ){

        alert(
            "Esta instalación no está vinculada a una empresa."
        );

        return;

    }


    const empresaId =
        Number(
            DB.config.licencia.empresaId
        );


    if(!empresaId){

        alert(
            "El identificador de la empresa no es válido."
        );

        return;

    }


    /* CONFIRMAR SOLICITUD */

    const confirmar =
        confirm(

            "Actualmente tiene " +

            obtenerCuposCobradores() +

            " cupos autorizados.\n\n" +

            "¿Desea solicitar 1 nuevo cupo de cobrador?"

        );


    if(!confirmar){

        return;

    }


    try{


        /* CREAR SOLICITUD EN SUPABASE */

    const {
        error
    } =
    await supabaseClient
        .from("solicitudes_cupos")
        .insert({

            empresa_id: empresaId,
            cantidad: 1,
            estado: "PENDIENTE"

        });


        if(error){

            console.error(
                "Error creando solicitud:",
                error
            );


            alert(
                "No se pudo enviar la solicitud a BKC Central."
            );


            return;

        }


        console.log(
            "Solicitud enviada correctamente"
        );


        alert(

            "Solicitud enviada correctamente.\n\n" +

            "Estado: PENDIENTE\n\n" +

            "El administrador de BKC debe aprobarla."

        );


    }catch(error){

        console.error(
            "Error inesperado enviando solicitud:",
            error
        );


        alert(
            "Ocurrió un error al enviar la solicitud."
        );

    }

}

document.addEventListener(
    "DOMContentLoaded",
    function(){

        const boton =
            document.getElementById(
                "btnActivarEmpresa"
            );

        if(boton){

            boton.addEventListener(
                "click",
                activarEmpresa
            );

        }
        const btnCrearAdministrador =
            document.getElementById(
                "btnCrearAdministradorPrincipal"
            );

        if(btnCrearAdministrador){

            btnCrearAdministrador.addEventListener(
                "click",
                crearAdministradorPrincipal
            );

        }
    }
);