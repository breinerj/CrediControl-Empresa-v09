/*=========================================================
    CREDICONTROL
    clientes.js
=========================================================*/

let clienteEditando = null;

/*=========================================================
    OBTENER EMPRESA ACTIVA
=========================================================*/

function obtenerEmpresaIdClientes(){

    const empresaId =
        DB.config?.licencia?.empresaId;

    if(!empresaId){

        console.error(
            "No existe empresa_id configurado."
        );

        return null;

    }

    return Number(empresaId);

}


/*=========================================================
    CARGAR CLIENTES DESDE SUPABASE
=========================================================*/

async function cargarClientesSupabase(){

    const empresaId =
        obtenerEmpresaIdClientes();

    if(!empresaId){

        console.warn(
            "No se pueden cargar clientes: empresa no identificada."
        );

        return false;

    }

    try{

        const {
            data,
            error
        } =
        await supabaseClient
            .from("clientes")
            .select("*")
            .eq(
                "empresa_id",
                empresaId
            )
            .order(
                "id",
                {
                    ascending: true
                }
            );


        if(error){

            console.error(
                "Error cargando clientes desde Supabase:",
                error
            );

            return false;

        }


        /*
            ACTUALIZAR COPIA LOCAL

            Conservamos local_id como ID utilizado
            actualmente por préstamos y demás módulos.
        */

        DB.clientes =
            (data || []).map(cliente => ({

                id:
                    cliente.local_id ??
                    cliente.id,

                supabaseId:
                    cliente.id,

                codigo:
                    cliente.codigo,

                nombre:
                    cliente.nombre,

                cedula:
                    cliente.cedula || "",

                telefono:
                    cliente.telefono || "",

                ciudad:
                    cliente.ciudad || "",

                direccion:
                    cliente.direccion || "",

                observaciones:
                    cliente.observaciones || "",

                estado:
                    cliente.estado || "ACTIVO"

            }));


        DB.guardar();

        listarClientes();


        console.log(
            "Clientes sincronizados desde Supabase:",
            DB.clientes.length
        );


        return true;


    }catch(error){

        console.error(
            "Error inesperado cargando clientes:",
            error
        );

        return false;

    }

}

/*=========================================================
    MIGRAR CLIENTES LOCALES A SUPABASE
=========================================================*/

async function migrarClientesLocalesASupabase(){

    const empresaId =
        obtenerEmpresaIdClientes();


    if(!empresaId){

        console.error(
            "No se puede migrar: empresa no identificada."
        );

        return false;

    }


    /*
        HACER COPIA DE LOS CLIENTES LOCALES
        ANTES DE CONSULTAR SUPABASE
    */

    const clientesLocales =
        Array.isArray(DB.clientes)
            ? [...DB.clientes]
            : [];


    console.log(
        "Clientes locales encontrados:",
        clientesLocales.length
    );


    if(clientesLocales.length === 0){

        console.log(
            "No existen clientes locales para migrar."
        );

        return true;

    }


    try{

        /*
            CONSULTAR CLIENTES YA EXISTENTES
            EN SUPABASE
        */

        const {
            data: clientesRemotos,
            error: errorConsulta
        } =
        await supabaseClient
            .from("clientes")
            .select(
                "id, local_id, cedula, codigo"
            )
            .eq(
                "empresa_id",
                empresaId
            );


        if(errorConsulta){

            console.error(
                "Error consultando clientes existentes:",
                errorConsulta
            );

            return false;

        }


        let migrados = 0;

        let existentes = 0;

        let errores = 0;


        /*
            MIGRAR UNO POR UNO

            Es más lento que un INSERT masivo,
            pero para esta primera migración
            permite controlar cada registro.
        */

        for(
            const cliente
            of clientesLocales
        ){

            /*
                BUSCAR SI YA FUE MIGRADO.

                Primero por local_id.

                Como segunda validación,
                usamos cédula cuando existe.
            */

            const yaExiste =
                (clientesRemotos || [])
                    .find(remoto => {

                        const mismoLocalId =
                            Number(remoto.local_id) ===
                            Number(cliente.id);


                        const mismaCedula =
                            cliente.cedula &&
                            remoto.cedula &&
                            String(remoto.cedula).trim() ===
                            String(cliente.cedula).trim();


                        return (
                            mismoLocalId ||
                            mismaCedula
                        );

                    });


            if(yaExiste){

                console.log(
                    "Cliente ya existente:",
                    cliente.nombre
                );

                existentes++;

                continue;

            }


            /*
                PREPARAR CLIENTE PARA SUPABASE
            */

            const nuevoCliente = {

                empresa_id:
                    empresaId,

                local_id:
                    Number(cliente.id),

                codigo:
                    cliente.codigo || null,

                nombre:
                    cliente.nombre,

                cedula:
                    cliente.cedula?.trim()
                        || null,

                telefono:
                    cliente.telefono
                        || null,

                ciudad:
                    cliente.ciudad
                        || null,

                direccion:
                    cliente.direccion
                        || null,

                observaciones:
                    cliente.observaciones
                        || null,

                estado:
                    cliente.estado
                        || "ACTIVO"

            };


            const {
                data,
                error
            } =
            await supabaseClient
                .from("clientes")
                .insert(
                    nuevoCliente
                )
                .select()
                .single();


            if(error){

                console.error(
                    "Error migrando cliente:",
                    cliente.nombre,
                    error
                );

                errores++;

                continue;

            }


            /*
                GUARDAR ID DE SUPABASE
                EN LA COPIA LOCAL
            */

            const clienteOriginal =
                DB.clientes.find(

                    c =>
                        Number(c.id) ===
                        Number(cliente.id)

                );


            if(clienteOriginal){

                clienteOriginal.supabaseId =
                    data.id;

            }


            /*
                AGREGAR A LA LISTA REMOTA
                PARA EVITAR DUPLICADOS
                DURANTE ESTA MISMA MIGRACION
            */

            clientesRemotos.push({

                id:
                    data.id,

                local_id:
                    data.local_id,

                cedula:
                    data.cedula,

                codigo:
                    data.codigo

            });


            migrados++;


            console.log(
                "Cliente migrado:",
                cliente.nombre
            );

        }


        /*
            GUARDAR LOS supabaseId
            ASIGNADOS LOCALMENTE
        */

        DB.guardar();


        console.log(
            "================================="
        );

        console.log(
            "MIGRACION DE CLIENTES FINALIZADA"
        );

        console.log(
            "Migrados:",
            migrados
        );

        console.log(
            "Ya existentes:",
            existentes
        );

        console.log(
            "Errores:",
            errores
        );

        console.log(
            "Total local:",
            clientesLocales.length
        );

        console.log(
            "================================="
        );


        return errores === 0;


    }catch(error){

        console.error(
            "Error inesperado durante la migración:",
            error
        );

        return false;

    }

}
/*=========================================================
    GUARDAR CLIENTE
=========================================================*/

document.addEventListener("DOMContentLoaded", () => {

    const btnGuardar = document.getElementById("guardarCliente");

    if (btnGuardar) {

        btnGuardar.addEventListener("click", guardarCliente);

    }

});

async function guardarCliente() {

    const nombre = document.getElementById("clienteNombre").value.trim();
    const cedula = document.getElementById("clienteCedula").value.trim();
    const telefono = document.getElementById("clienteTelefono").value.trim();
    const ciudad = document.getElementById("clienteCiudad").value.trim();
    const direccion = document.getElementById("clienteDireccion").value.trim();
    const observaciones = document.getElementById("clienteObservaciones").value.trim();

    if (nombre === "") {

        alert("Debe ingresar el nombre del cliente");

        return;

    }

    // Validar cédula duplicada
    const existe = DB.clientes.find(c =>
        c.cedula === cedula &&
        c.id !== clienteEditando
    );

    if (cedula !== "" && existe) {

        alert("Ya existe un cliente con esa cédula");

        return;

    }

    if (clienteEditando === null) {

    const resultado =
        await agregarClienteSupabase({

            id: generarId(),

            nombre,

            cedula,

            telefono,

            ciudad,

            direccion,

            observaciones,

            estado: "ACTIVO"

        });


    if(!resultado){

        alert(
            "No fue posible guardar el cliente."
        );

        return;

    }

} else {

    const cliente =
        DB.clientes.find(
            c =>
                Number(c.id) ===
                Number(clienteEditando)
        );

    if(!cliente){

        alert(
            "No se encontró el cliente."
        );

        return;

    }


    /*
        GUARDAR COPIA DE LOS DATOS ANTERIORES
        POR SI SUPABASE PRESENTA UN ERROR
    */

    const datosAnteriores = {
        ...cliente
    };


    cliente.nombre =
        nombre;

    cliente.cedula =
        cedula;

    cliente.telefono =
        telefono;

    cliente.ciudad =
        ciudad;

    cliente.direccion =
        direccion;

    cliente.observaciones =
        observaciones;


    const actualizado =
        await actualizarClienteSupabase(
            cliente
        );


    if(!actualizado){

        /*
            RESTAURAR DATOS LOCALES
            SI FALLA SUPABASE
        */

        Object.assign(
            cliente,
            datosAnteriores
        );

        alert(
            "No fue posible actualizar el cliente."
        );

        return;

    }


    DB.guardar();

    clienteEditando =
        null;

}

    listarClientes();

    actualizarDashboard();

    cerrarModalCliente();

}

/*=========================================================
    LISTAR CLIENTES
=========================================================*/

function listarClientes() {

    const tabla = document.getElementById("tablaClientes");

    if (!tabla) return;

    tabla.innerHTML = "";

    DB.clientes.forEach(cliente => {

        tabla.innerHTML += `

        <tr>

            <td>${cliente.codigo}</td>

            <td>${cliente.nombre}</td>

            <td>${cliente.cedula}</td>

            <td>${cliente.telefono}</td>

            <td>${dinero(obtenerCapitalPrestado(cliente.id))}</td>

            <td>${dinero(obtenerCapitalRecuperado(cliente.id))}</td>

            <td>${dinero(obtenerSaldoCliente(cliente.id))}</td>

            <td>

    <span class="badge bg-primary">

        ${contarPrestamosActivos(cliente.id)}

    </span>

</td>

<td>

                <td>

                    <span class="badge ${cliente.estado==="ACTIVO" ? "bg-success" : "bg-secondary"}">

                        ${cliente.estado}

                    </span>

                </td>

            <td>

                <button
                    class="btn btn-warning btn-sm"
                    onclick="editarCliente(${cliente.id})">

                    Editar

                </button>

                <button

                    class="btn btn-info btn-sm"

                    onclick="verResumenCliente(${cliente.id})">

                    Resumen

                </button>

                ${cliente.estado === "ACTIVO" ? `

                <button
                    class="btn btn-secondary btn-sm"
                    onclick="inactivarCliente(${cliente.id})">

                    ⛔ Inactivar

                </button>

                ` : `

                <button
                    class="btn btn-success btn-sm"
                    onclick="reactivarCliente(${cliente.id})">

                    ✅ Reactivar

                </button>

                `}

            </td>

        </tr>

        `;

    });

}

/*=========================================================
    ACTUALIZAR CLIENTE EN SUPABASE
=========================================================*/

async function actualizarClienteSupabase(cliente){

    if(!cliente.supabaseId){

        console.error(
            "El cliente no tiene supabaseId:",
            cliente
        );

        return false;

    }

    try{

        const {
            error
        } =
        await supabaseClient
            .from("clientes")
            .update({

                nombre:
                    cliente.nombre,

                cedula:
                    cliente.cedula?.trim() || null,

                telefono:
                    cliente.telefono || null,

                ciudad:
                    cliente.ciudad || null,

                direccion:
                    cliente.direccion || null,

                observaciones:
                    cliente.observaciones || null,

                estado:
                    cliente.estado || "ACTIVO",

                updated_at:
                    new Date().toISOString()

            })
            .eq(
                "id",
                cliente.supabaseId
            );

        if(error){

            console.error(
                "Error actualizando cliente en Supabase:",
                error
            );

            return false;

        }

        console.log(
            "Cliente actualizado en Supabase:",
            cliente.nombre
        );

        return true;

    }catch(error){

        console.error(
            "Error inesperado actualizando cliente:",
            error
        );

        return false;

    }

}

/*=========================================================
    EDITAR
=========================================================*/

function editarCliente(id){

    const cliente = DB.clientes.find(c => c.id === id);

    if(!cliente) return;

    clienteEditando = id;

    document.getElementById("clienteNombre").value = cliente.nombre;
    document.getElementById("clienteCedula").value = cliente.cedula;
    document.getElementById("clienteTelefono").value = cliente.telefono;
    document.getElementById("clienteCiudad").value = cliente.ciudad;
    document.getElementById("clienteDireccion").value = cliente.direccion;
    document.getElementById("clienteObservaciones").value = cliente.observaciones;

    abrirModalCliente();

}



    /*=========================================================
    AGREGAR CLIENTE EN SUPABASE
=========================================================*/

async function agregarClienteSupabase(cliente){

    const empresaId =
        obtenerEmpresaIdClientes();


    if(!empresaId){

        console.error(
            "No se puede crear cliente: empresa no identificada."
        );

        return false;

    }


    /*
        GENERAR CODIGO CON LA ESTRUCTURA ACTUAL

        Más adelante moveremos el consecutivo
        al servidor para evitar colisiones
        entre varios dispositivos.
    */

    cliente.codigo =
        "CLI-" +
        String(
            DB.clientes.length + 1
        ).padStart(
            5,
            "0"
        );


    try{

        const nuevoCliente = {

            empresa_id:
                empresaId,

            local_id:
                Number(cliente.id),

            codigo:
                cliente.codigo,

            nombre:
                cliente.nombre,

            cedula:
                cliente.cedula?.trim()
                    || null,

            telefono:
                cliente.telefono
                    || null,

            ciudad:
                cliente.ciudad
                    || null,

            direccion:
                cliente.direccion
                    || null,

            observaciones:
                cliente.observaciones
                    || null,

            estado:
                cliente.estado
                    || "ACTIVO"

        };


        const {
            data,
            error
        } =
        await supabaseClient
            .from("clientes")
            .insert(
                nuevoCliente
            )
            .select()
            .single();


        if(error){

            console.error(
                "Error creando cliente en Supabase:",
                error
            );

            return false;

        }


        /*
            SOLO DESPUES DE CONFIRMAR QUE SUPABASE
            GUARDO CORRECTAMENTE EL CLIENTE,
            ACTUALIZAMOS LA COPIA LOCAL.
        */

        cliente.supabaseId =
            data.id;


        DB.clientes.push(
            cliente
        );


        DB.guardar();


        console.log(
            "Cliente guardado en Supabase:",
            cliente.nombre
        );


        return true;


    }catch(error){

        console.error(
            "Error inesperado creando cliente:",
            error
        );

        return false;

    }

}

/*=========================================================
    FUNCION LOCAL ANTIGUA
=========================================================*/

function agregarCliente(cliente){

    cliente.codigo =
        "CLI-" +
        String(
            DB.clientes.length + 1
        ).padStart(5, "0");

    DB.clientes.push(cliente);

    DB.guardar();

}

/*=========================================================
    INACTIVAR CLIENTE
    SUPABASE + COPIA LOCAL
=========================================================*/

async function inactivarCliente(id){

    const cliente =
        DB.clientes.find(
            c =>
                Number(c.id) ===
                Number(id)
        );

    if(!cliente){

        alert(
            "No se encontró el cliente."
        );

        return;

    }


    if(
        !confirm(
            "¿Desea inactivar este cliente?"
        )
    ){

        return;

    }


    if(!cliente.supabaseId){

        console.error(
            "El cliente no tiene supabaseId:",
            cliente
        );

        alert(
            "No fue posible identificar el cliente en Supabase."
        );

        return;

    }


    try{

        const {
            error
        } =
        await supabaseClient
            .from("clientes")
            .update({

                estado:
                    "INACTIVO",

                updated_at:
                    new Date()
                        .toISOString()

            })
            .eq(
                "id",
                cliente.supabaseId
            );


        if(error){

            console.error(
                "Error inactivando cliente en Supabase:",
                error
            );

            alert(
                "No fue posible inactivar el cliente."
            );

            return;

        }


        /*
            ACTUALIZAR COPIA LOCAL
            SOLO DESPUES DEL EXITO EN SUPABASE
        */

        cliente.estado =
            "INACTIVO";


        DB.guardar();


        listarClientes();


        console.log(
            "Cliente inactivado en Supabase:",
            cliente.nombre
        );


    }catch(error){

        console.error(
            "Error inesperado inactivando cliente:",
            error
        );

        alert(
            "Ocurrió un error al inactivar el cliente."
        );

    }

}


/*=========================================================
    REACTIVAR CLIENTE
=========================================================*/

async function reactivarCliente(id){

    const cliente =
        DB.clientes.find(
            c => Number(c.id) === Number(id)
        );

    if(!cliente){

        alert("No se encontró el cliente.");

        return;

    }

    if(
        !confirm("¿Desea reactivar este cliente?")
    ){

        return;

    }

    try{

        const { error } =
            await supabaseClient
                .from("clientes")
                .update({

                    estado: "ACTIVO",

                    updated_at:
                        new Date().toISOString()

                })
                .eq(
                    "id",
                    cliente.supabaseId
                );

        if(error){

            console.error(error);

            alert(
                "No fue posible reactivar el cliente."
            );

            return;

        }

        cliente.estado = "ACTIVO";

        DB.guardar();

        listarClientes();

        console.log(
            "Cliente reactivado:",
            cliente.nombre
        );

    }catch(error){

        console.error(error);

        alert(
            "Error reactivando cliente."
        );

    }

}

/*=========================================================
    MODAL CLIENTE
=========================================================*/

let modalCliente;

function abrirModalCliente(){

    if(!modalCliente){

        modalCliente = new bootstrap.Modal(

            document.getElementById("modalCliente")

        );

    }

    modalCliente.show();

}

function cerrarModalCliente(){

    if(modalCliente){

        modalCliente.hide();

    }

    limpiarFormularioCliente();

}

/*=========================================================
    LIMPIAR FORMULARIO
=========================================================*/

function limpiarFormularioCliente(){

    document.getElementById("clienteNombre").value="";

    document.getElementById("clienteCedula").value="";

    document.getElementById("clienteTelefono").value="";

    document.getElementById("clienteCiudad").value="";

    document.getElementById("clienteDireccion").value="";

    document.getElementById("clienteObservaciones").value="";

    clienteEditando=null;

}
/*=========================================================
    SALDO TOTAL CLIENTE
=========================================================*/

function obtenerSaldoCliente(clienteId){

    let saldo = 0;

    DB.prestamos.forEach(prestamo=>{

        if(Number(prestamo.clienteId)===Number(clienteId)){

            saldo += Number(prestamo.saldoTotal || 0);

        }

    });

    return saldo;

}
/*=========================================================
    CAPITAL PRESTADO CLIENTE
=========================================================*/

function obtenerCapitalPrestado(clienteId){

    let total = 0;

    DB.prestamos.forEach(prestamo=>{

        if(Number(prestamo.clienteId)===Number(clienteId)){

            total += Number(prestamo.capital || 0);

        }

    });

    return total;

}

/*=========================================================
    CAPITAL RECUPERADO CLIENTE
=========================================================*/

function obtenerCapitalRecuperado(clienteId){

    let total = 0;

    DB.prestamos.forEach(prestamo=>{

        if(Number(prestamo.clienteId)===Number(clienteId)){

            total += Number(prestamo.capitalRecuperado || 0);

        }

    });

    return total;

}

/*=========================================================
    PRESTAMOS ACTIVOS
=========================================================*/

function contarPrestamosActivos(clienteId){

    return DB.prestamos.filter(

        p=>Number(p.clienteId)===Number(clienteId)

        && p.estado==="ACTIVO"

    ).length;

}
/*=========================================================
    VER RESUMEN CLIENTE
=========================================================*/

function verResumenCliente(id){

    const cliente = DB.clientes.find(

        c=>Number(c.id)===Number(id)

    );

    if(!cliente) return;

    const datos = Estadisticas.cliente(id);

    alert(

`CLIENTE

${cliente.nombre}

--------------------------------

Capital Prestado:

${dinero(datos.capitalPrestado)}

Capital Recuperado:

${dinero(datos.capitalRecuperado)}

Intereses Recuperados:

${dinero(datos.interesesRecuperados)}

Saldo:

${dinero(datos.saldo)}

Préstamos:

${datos.prestamos}

Activos:

${datos.activos}`

    );

}

