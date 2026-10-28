/*=========================================================
    CREDICONTROL
    prestamos.js
=========================================================*/

let prestamoEditando = null;


let prestamoRenovacionActual = null;
let saldoCalculadoRenovacion = 0;

function normalizarDinero(valor) {
    const numero = Number(valor || 0);
    return Number.isFinite(numero)
        ? Math.max(0, numero)
        : 0;
}

/*
 * Calcula lo pendiente de cada cuota,
 * descontando los pagos parciales.
 * No genera registros de pagos.
 */
function calcularSaldoPendienteRenovacion(cronograma) {
    if (!Array.isArray(cronograma)) return 0;

    const saldo = cronograma.reduce((acumulado, cuota) => {
        if (
            String(cuota.estado || "").toUpperCase() === "PAGADA"
        ) {
            return acumulado;
        }

        const valor = normalizarDinero(cuota.valor);
        const pagado = normalizarDinero(cuota.pagado);

        return acumulado + Math.max(0, valor - pagado);
    }, 0);

    return Math.round(saldo);
}

function actualizarResumenRenovacion() {
    const panel = document.getElementById("panelRenovacion");

    if (!panel || !prestamoRenovacionActual) return;

    const capital = normalizarDinero(
        document.getElementById("capital")?.value
    );

    saldoCalculadoRenovacion =
        calcularSaldoPendienteRenovacion(
            prestamoRenovacionActual.cronograma || []
        );

    const saldo = document.getElementById(
        "saldoAnteriorRenovacion"
    );

    const aplicado = document.getElementById(
        "montoAplicadoRenovacion"
    );

    const nuevo = document.getElementById(
        "valorNuevoCreditoRenovacion"
    );

    const neto = document.getElementById(
        "dineroNetoRenovacion"
    );

    if (saldo) saldo.value = dinero(saldoCalculadoRenovacion);

    if (aplicado) {
        aplicado.value = String(saldoCalculadoRenovacion);
        aplicado.readOnly = true;
    }

    if (nuevo) nuevo.value = dinero(capital);

    if (neto) {
        neto.value = dinero(
            Math.max(0, capital - saldoCalculadoRenovacion)
        );
    }
}

function ocultarPanelRenovacion() {
    prestamoRenovacionActual = null;
    saldoCalculadoRenovacion = 0;

    const panel = document.getElementById("panelRenovacion");

    if (panel) panel.classList.add("d-none");
}

/*=========================================================
    EVENTOS
=========================================================*/

document.addEventListener("DOMContentLoaded",()=>{

    const btn=document.getElementById("btnGuardarPrestamo");

    if(btn){

        btn.addEventListener("click",guardarPrestamo);

    }

    const controles=[

        "capital",
        "interes",
        "meses",
        "periodicidad"

    ];

    controles.forEach(id=>{

        let c=document.getElementById(id);

        if(c){

            c.addEventListener("input",calcularPrestamo);
            c.addEventListener("change",calcularPrestamo);

        }

    });

});

/*=========================================================
        SELECT CLIENTES
=========================================================*/

function cargarSelectClientes(){

    const select = document.getElementById("prestamoCliente");

    select.innerHTML = "";

    DB.clientes
        .filter(cliente => cliente.estado === "ACTIVO")
        .forEach(cliente => {

            select.innerHTML += `
                <option value="${cliente.id}">
                    ${cliente.nombre}
                </option>
            `;

        });
    }

/*=========================================================
        GUARDAR PRESTAMO
=========================================================*/

async function finalizarRenovacionSupabase(
    prestamoAnterior,
    prestamoNuevo
) {
    if (
        !prestamoAnterior?.supabaseId ||
        !prestamoNuevo?.supabaseId
    ) {
        console.error("Faltan los IDs de los créditos para renovar.");
        return false;
    }

    const anteriorId = prestamoAnterior.supabaseId;
    const nuevoId = prestamoNuevo.supabaseId;

    // Verificar que el nuevo crédito existe y está activo.
    const {
        data: nuevo,
        error: errorNuevo
    } = await supabaseClient
        .from("prestamos")
        .select("id, estado, renovado_de_id")
        .eq("id", nuevoId)
        .maybeSingle();

    if (errorNuevo || !nuevo) {
        console.error("No se encontró el nuevo crédito:", errorNuevo);
        return false;
    }

    // Desactivar el cronograma anterior conservando sus registros.
    const {
        error: errorCronograma
    } = await supabaseClient
        .from("cronograma_prestamos")
        .update({ activo: false })
        .eq("prestamo_id", anteriorId)
        .eq("activo", true);

    if (errorCronograma) {
        console.error(
            "Error desactivando el cronograma anterior:",
            errorCronograma
        );
        return false;
    }

    // Marcar el crédito anterior como renovado.
    const {
        error: errorAnterior
    } = await supabaseClient
        .from("prestamos")
        .update({
            estado: "RENOVADO",
            archivado: true
        })
        .eq("id", anteriorId)
        .eq("estado", "ACTIVO");

    if (errorAnterior) {
        console.error(
            "Error actualizando el crédito anterior:",
            errorAnterior
        );

        // Intentar restaurar su cronograma si no se pudo cerrar.
        const { error: errorRestaurar } = await supabaseClient
            .from("cronograma_prestamos")
            .update({ activo: true })
            .eq("prestamo_id", anteriorId)
            .eq("activo", false);

        if (errorRestaurar) {
            console.error(
                "No se pudo restaurar el cronograma:",
                errorRestaurar
            );
        }

        return false;
    }

    return true;
}

async function revertirNuevoPrestamoSupabase(prestamoNuevo) {
    if (!prestamoNuevo?.supabaseId) return false;

    const prestamoId = prestamoNuevo.supabaseId;

    // Primero eliminar el cronograma nuevo.
    const {
        error: errorCronograma
    } = await supabaseClient
        .from("cronograma_prestamos")
        .delete()
        .eq("prestamo_id", prestamoId);

    if (errorCronograma) {
        console.error(
            "No se pudo eliminar el cronograma nuevo:",
            errorCronograma
        );
        return false;
    }

    // Después eliminar el crédito nuevo.
    const {
        error: errorPrestamo
    } = await supabaseClient
        .from("prestamos")
        .delete()
        .eq("id", prestamoId);

    if (errorPrestamo) {
        console.error(
            "No se pudo eliminar el crédito nuevo:",
            errorPrestamo
        );
        return false;
    }

    DB.prestamos = DB.prestamos.filter(
        p => Number(p.supabaseId) !== Number(prestamoId)
    );

    DB.guardar();

    return true;
}


/*=========================================================
    SOLICITUD DE RENOVACIÓN EN SUPABASE
=========================================================*/

async function crearSolicitudRenovacionSupabase({
    anterior,
    cliente,
    capital,
    interes,
    tipoInteres,
    meses,
    periodicidad,
    fechaPrestamo,
    primerPago,
    observaciones,
    interesTotal,
    total,
    saldoAplicado,
    cronograma
}) {
    try {
        const {
            data: { user },
            error: errorUsuario
        } = await supabaseClient.auth.getUser();

        if (errorUsuario || !user) {
            throw new Error(
                "No se pudo identificar la sesión del usuario."
            );
        }

        const { data: usuarioEmpresa, error: errorEmpresa } =
            await supabaseClient
                .from("usuarios_empresa")
                .select("id, empresa_id, rol, estado")
                .eq("auth_user_id", user.id)
                .eq("estado", "ACTIVO")
                .maybeSingle();

        if (errorEmpresa) throw errorEmpresa;

        if (!usuarioEmpresa) {
            throw new Error(
                "No se encontró un usuario activo asociado a la empresa."
            );
        }

        const rolUsuario = String(
            usuarioEmpresa.rol || ""
        ).trim().toUpperCase();

        if (rolUsuario !== "COBRADOR") {
            console.error("Validación de rol fallida:", {
                usuarioEmpresaId: usuarioEmpresa.id,
                rolEncontrado: usuarioEmpresa.rol,
                estado: usuarioEmpresa.estado,
                authUserId: user.id
            });

    throw new Error(
        `La solicitud de renovación es exclusiva de los cobradores. ` +
        `Rol identificado: ${rolUsuario || "SIN ROL"}.`
    );
}

        if (
            Number(usuarioEmpresa.empresa_id) !==
            Number(DB.config?.licencia?.empresaId)
        ) {
            throw new Error(
                "La empresa de la sesión no coincide con la empresa activa."
            );
        }

        if (!cliente?.supabaseId || !anterior?.supabaseId) {
            throw new Error(
                "El cliente o el crédito anterior no están sincronizados."
            );
        }

        if (!Array.isArray(cronograma) || cronograma.length === 0) {
            throw new Error(
                "No se puede enviar la solicitud sin un cronograma válido."
            );
        }

        const solicitud = {
            empresa_id: usuarioEmpresa.empresa_id,
            prestamo_anterior_id: anterior.supabaseId,
            cliente_id: cliente.supabaseId,
            solicitante_usuario_empresa_id: usuarioEmpresa.id,

            capital_solicitado: capital,
            saldo_aplicar: saldoAplicado,
            observaciones: observaciones || null,

            estado: "PENDIENTE",

            interes_solicitado: interes,
            tipo_interes_solicitado: tipoInteres,
            meses_solicitados: meses,
            periodicidad_solicitada: periodicidad,
            fecha_prestamo_solicitada: fechaPrestamo,
            primer_pago_solicitado: primerPago,

            cronograma_propuesto: cronograma.map(cuota => ({
                numero: Number(cuota.numero),
                fecha: cuota.fecha,
                capital: Number(cuota.capital || 0),
                interes: Number(cuota.interes || 0),
                valor: Number(cuota.valor || 0),
                saldo: Number(cuota.saldo || 0)
            })),

            interes_total_propuesto: interesTotal,
            total_propuesto: total
        };

        const { data, error } = await supabaseClient
            .from("solicitudes_renovacion")
            .insert(solicitud)
            .select("id, estado")
            .single();

        if (error) throw error;

        return data;

    } catch (error) {
        console.error(
            "Error creando solicitud de renovación:",
            error
        );

        throw error;
    }
}


/*=========================================================
    GUARDAR PRESTAMO Y PROCESAR RENOVACION
=========================================================*/

async function guardarPrestamo() {
    const usuarioEsAdministrador = esAdministrador();

// Permitir créditos nuevos a administradores y cobradores activos.
if (!usuarioEsAdministrador && !prestamoRenovacionActual) {
    try {
        const { data: { user }, error: errorUsuario } =
            await supabaseClient.auth.getUser();

        if (errorUsuario || !user) {
            throw new Error("No se pudo identificar la sesión del usuario.");
        }

        const { data: usuarioEmpresa, error: errorEmpresa } =
            await supabaseClient
                .from("usuarios_empresa")
                .select("id, empresa_id, rol, estado")
                .eq("auth_user_id", user.id)
                .eq("estado", "ACTIVO")
                .maybeSingle();

        if (errorEmpresa) {
            throw errorEmpresa;
        }

        const rolUsuario = String(
            usuarioEmpresa?.rol || ""
        ).trim().toUpperCase();

        if (
            !usuarioEmpresa ||
            !["ADMINISTRADOR", "ADMIN", "COBRADOR"].includes(rolUsuario)
        ) {
            throw new Error(
                "El usuario no tiene un rol autorizado para crear créditos."
            );
        }

        if (
            String(usuarioEmpresa.estado || "").trim().toUpperCase() !== "ACTIVO"
        ) {
            throw new Error(
                "El usuario debe estar activo para crear créditos."
            );
        }

        if (
            Number(usuarioEmpresa.empresa_id) !==
            Number(DB.config?.licencia?.empresaId)
        ) {
            throw new Error(
                "La empresa de la sesión no coincide con la empresa activa."
            );
        }

    } catch (errorPermisos) {
        alert(
            errorPermisos.message ||
            "No tiene permisos para crear créditos."
        );
        return;
    }
}

    const boton = document.getElementById("btnGuardarPrestamo");

    if (boton?.dataset.guardando === "true") return;

    if (boton) {
        boton.dataset.guardando = "true";
        boton.disabled = true;
    }

    try {
        const clienteId = Number(
            document.getElementById("prestamoCliente")?.value
        );

        const cliente = DB.clientes.find(
            c => Number(c.id) === clienteId
        );

        if (!cliente || cliente.estado !== "ACTIVO") {
            alert("Seleccione un cliente activo.");
            return;
        }

        const capital = Number(
            document.getElementById("capital")?.value
        );

        const interes = Number(
            document.getElementById("interes")?.value
        );

        const meses = Number(
            document.getElementById("meses")?.value
        );

        if (
            !Number.isFinite(capital) || capital <= 0 ||
            !Number.isFinite(interes) || interes < 0 ||
            !Number.isInteger(meses) || meses <= 0
        ) {
            alert("Verifique el capital, el interés y el plazo.");
            return;
        }

        const anterior = prestamoRenovacionActual;

        if (anterior && Number(anterior.clienteId) !== clienteId) {
            alert("El cliente seleccionado no coincide con el crédito que se va a renovar.");
            return;
        }

        if (anterior && !anterior.supabaseId) {
            alert("El crédito anterior no está sincronizado con Supabase.");
            return;
        }

        const saldoAplicado = anterior
            ? calcularSaldoPendienteRenovacion(anterior.cronograma || [])
            : 0;

        if (anterior && capital < saldoAplicado) {
            alert(
                "El capital del nuevo crédito no puede ser inferior al saldo pendiente anterior.\n\n" +
                "Saldo anterior: " + dinero(saldoAplicado) + "\n" +
                "Nuevo capital: " + dinero(capital)
            );
            return;
        }

        if (anterior) {
            const confirmar = confirm(
                "CONFIRMAR RENOVACIÓN\n\n" +
                "Cliente: " + cliente.nombre + "\n" +
                "Capital del nuevo crédito: " + dinero(capital) + "\n" +
                "Saldo aplicado del crédito anterior: " + dinero(saldoAplicado) + "\n" +
                "Dinero neto a entregar: " + dinero(capital - saldoAplicado) + "\n\n" +
                "El crédito anterior quedará como RENOVADO y su cronograma dejará de estar activo.\n\n" +
                "¿Desea continuar?"
            );

            if (!confirmar) return;
        }

        const cronograma = construirCronograma();

        if (!Array.isArray(cronograma) || cronograma.length === 0) {
            alert("No se pudo generar el cronograma del crédito.");
            return;
        }

        const interesTotal = cronograma.reduce(
            (suma, cuota) => suma + Number(cuota.interes || 0),
            0
        );

        const total = capital + interesTotal;

      
// LOS COBRADORES SOLO PUEDEN ENVIAR SOLICITUDES.
if (!usuarioEsAdministrador) {
    try {
        const {
            data: { user },
            error: errorAuth
        } = await supabaseClient.auth.getUser();

        if (errorAuth || !user) {
            throw new Error("Sesión no válida. Inicia sesión nuevamente.");
        }
        console.log("UUID autenticado:", user.id);
        alert("UUID autenticado: " + user.id);

        const { data: usuariosEmpresa, error: errorUsuario } =
            await supabaseClient
                .from("usuarios_empresa")
                .select("id, auth_user_id, empresa_id, rol, estado")
                .eq("auth_user_id", user.id);

        console.log("Usuarios encontrados:", usuariosEmpresa);
        alert(
            "Usuarios encontrados: " +
            JSON.stringify(usuariosEmpresa)
        );
        console.log("Error de consulta:", errorUsuario);

        if (errorUsuario) throw errorUsuario;

        const usuarioEmpresa = (usuariosEmpresa || []).find(u =>
            Number(u.empresa_id) ===
                Number(DB.config?.licencia?.empresaId) &&
            ["ACTIVO", "ACTIVE"].includes(
                String(u.estado || "").trim().toUpperCase()
            ) &&
            String(u.rol || "").trim().toUpperCase() === "COBRADOR"
        );

        if (!usuarioEmpresa) {
            throw new Error(
                "El usuario autenticado no coincide con un cobrador activo de la empresa. Revisa la consola (F12)."
            );
        }

        if (errorUsuario) throw errorUsuario;

        if (
            !usuarioEmpresa ||
            String(usuarioEmpresa.rol).trim().toUpperCase() !== "COBRADOR"
        ) {
            throw new Error("Solo un cobrador activo puede enviar solicitudes.");
        }

        if (
            Number(usuarioEmpresa.empresa_id) !==
            Number(DB.config?.licencia?.empresaId)
        ) {
            throw new Error("La empresa del usuario no coincide.");
        }

        if (!cliente.supabaseId) {
            throw new Error(
                "El cliente no está sincronizado con Supabase."
            );
        }

        const { data: solicitud, error: errorSolicitud } =
            await supabaseClient
                .from("solicitudes_credito")
                .insert({
                    empresa_id: usuarioEmpresa.empresa_id,
                    cliente_id: cliente.supabaseId,
                    solicitante_usuario_empresa_id: usuarioEmpresa.id,
                    capital_solicitado: capital,
                    interes_solicitado: interes,
                    tipo_interes_solicitado:
                        document.getElementById("tipoInteres").value,
                    meses_solicitados: meses,
                    periodicidad_solicitada:
                        document.getElementById("periodicidad").value,
                    fecha_prestamo_solicitada:
                        document.getElementById("fechaPrestamo").value || null,
                    primer_pago_solicitado:
                        document.getElementById("primerPago").value || null,
                    observaciones:
                        document.getElementById("observacionesPrestamo").value,
                    cronograma_propuesto: cronograma,
                    interes_total_propuesto: interesTotal,
                    total_propuesto: total,
                    estado: "PENDIENTE"
                })
                .select("id")
                .single();

        if (errorSolicitud) throw errorSolicitud;

        alert(
            "Solicitud enviada correctamente.\n\n" +
            "Número: " + solicitud.id + "\n" +
            "Estado: PENDIENTE\n\n" +
            "El crédito solo se creará cuando el administrador la apruebe."
        );

        cerrarModalPrestamo();
        ocultarPanelRenovacion();
        return;

    } catch (error) {
        console.error("Error creando solicitud de crédito:", error);

        alert(
            "No fue posible enviar la solicitud:\n" +
            (error.message || error)
        );

        return;
    }
}


        const nuevoPrestamo = await agregarPrestamoSupabase({
            id: Date.now(),
            clienteId,
            capital,
            interes,
            tipoInteres: document.getElementById("tipoInteres").value,
            meses,
            periodicidad: document.getElementById("periodicidad").value,
            fechaPrestamo: document.getElementById("fechaPrestamo").value,
            primerPago: document.getElementById("primerPago").value,
            observaciones: document.getElementById("observacionesPrestamo").value,
            interesTotal,
            total,
            saldoCapital: capital,
            saldoTotal: total,
            capitalRecuperado: 0,
            interesRecuperado: 0,
            estado: "ACTIVO",
            archivado: false,
            cronograma,

            // Datos de trazabilidad de la renovación.
            renovadoDeId: anterior ? anterior.supabaseId : null,
            montoSaldoAplicado: saldoAplicado,
            fechaRenovacion: anterior
                ? (document.getElementById("fechaPrestamo").value || hoy())
                : null
        });


                if (!nuevoPrestamo) {
                    alert("No se pudo guardar el nuevo crédito. El crédito anterior no se ha cerrado.");
                    return;
                }

                if (anterior) {
                    const renovacionFinalizada = await finalizarRenovacionSupabase(
                        anterior,
                        nuevoPrestamo
                    );

                    if (!renovacionFinalizada) {
                        const revertido = await revertirNuevoPrestamoSupabase(
                            nuevoPrestamo
                        );

                        alert(
                            "No se pudo completar la renovación.\n" +
                            (revertido
                                ? "Se revirtió el nuevo crédito."
                                : "ATENCIÓN: no se pudo revertir automáticamente el nuevo crédito. Revise Supabase antes de intentar otra vez.")
                        );
                        return;
                    }

                    anterior.estado = "RENOVADO";
                    anterior.archivado = true;

                    if (Array.isArray(anterior.cronograma)) {
                        anterior.cronograma.forEach(cuota => {
                            cuota.activo = false;
                        });
                    }

                    DB.guardar();
                }

                listarPrestamos();

                if (typeof actualizarDashboard === "function") {
                    actualizarDashboard();
                }

                cerrarModalPrestamo();
                ocultarPanelRenovacion();

                // Abrir el detalle del crédito recién creado.
                await abrirCronograma(nuevoPrestamo.id);

                alert(
                    anterior
                        ? "Renovación guardada correctamente.\n\n" +
                        "Saldo aplicado: " + dinero(saldoAplicado) + "\n" +
                        "Dinero neto a entregar: " + dinero(capital - saldoAplicado)
                        : "Crédito guardado correctamente."
                );

            } catch (error) {
                console.error("Error en guardarPrestamo:", error);
                alert("No fue posible guardar el crédito:\n" + (error.message || error));
            } finally {
                if (boton) {
                    boton.dataset.guardando = "false";
                    boton.disabled = false;
                }
            }
        }



/***********************************************************
    CARGAR PRÉSTAMOS DESDE SUPABASE
***********************************************************/
async function cargarPrestamosSupabase(){

    try{

        const empresaId =
            DB.config?.licencia?.empresaId;

        if(!empresaId){

            console.error(
                "Empresa no identificada al cargar préstamos."
            );

            return false;

        }

        /*
            OBTENER PRÉSTAMOS
            DESDE SUPABASE
        */

        const {
            data,
            error
        } =
        await supabaseClient
            .from("prestamos")
            .select("*")
            .eq(
                "empresa_id",
                empresaId
            )
            .order(
                "id",
                {
                    ascending:true
                }
            );

        if(error){

            console.error(
                "Error cargando préstamos desde Supabase:",
                error
            );

            return false;

        }


        /*
            RECONSTRUIR FORMATO
            DE CREDICONTROL
        */

        const prestamosCargados = [];

        for(const prestamo of data){

            /*
                CARGAR CRONOGRAMA
                DEL PRÉSTAMO
            */

            const cronograma =
                await obtenerCronogramaSupabase(
                    prestamo.id
                );


            prestamosCargados.push({

                /*
                    ID LOCAL
                */

                id:
                    Number(
                        prestamo.local_id
                    ),

                /*
                    ID SUPABASE
                */

                supabaseId:
                    prestamo.id,

                codigo:
                    prestamo.codigo,

                clienteId:
                    Number(
                        prestamo.cliente_local_id
                    ),

                capital:
                    Number(
                        prestamo.capital || 0
                    ),

                interes:
                    Number(
                        prestamo.interes || 0
                    ),

                tipoInteres:
                    prestamo.tipo_interes,

                meses:
                    Number(
                        prestamo.meses || 0
                    ),

                periodicidad:
                    prestamo.periodicidad,

                fechaPrestamo:
                    prestamo.fecha_prestamo,

                primerPago:
                    prestamo.primer_pago,

                observaciones:
                    prestamo.observaciones,

                interesTotal:
                    Number(
                        prestamo.interes_total || 0
                    ),

                total:
                    Number(
                        prestamo.total || 0
                    ),

                saldoCapital:
                    Number(
                        prestamo.saldo_capital || 0
                    ),

                saldoTotal:
                    Number(
                        prestamo.saldo_total || 0
                    ),

                capitalRecuperado:
                    Number(
                        prestamo.capital_recuperado || 0
                    ),

                interesRecuperado:
                    Number(
                        prestamo.interes_recuperado || 0
                    ),

                estado:
                    prestamo.estado,

                archivado:
                    prestamo.archivado || false,

                cronograma:
                    cronograma || []

            });

        }


        /*
            REEMPLAZAR CACHÉ LOCAL
        */

        DB.prestamos =
            prestamosCargados;


        /*
            GUARDAR CACHÉ
            EN LOCALSTORAGE
        */

        DB.guardar();


        console.log(
            "Préstamos cargados desde Supabase:",
            DB.prestamos.length
        );

        return true;


    }catch(error){

        console.error(
            "Error cargarPrestamosSupabase:",
            error
        );

        return false;

    }

}
/*=========================================================
        LISTAR PRESTAMOS
=========================================================*/

function listarPrestamos(){

    let tabla=document.getElementById("tablaPrestamos");

    if(!tabla) return;

    tabla.innerHTML = "";


/*
    IDENTIFICAR USUARIO ACTUAL
*/

const usuario =
    obtenerUsuarioActual();

console.log(
    "USUARIO DESDE LISTAR PRESTAMOS:",
    usuario
);

if(!usuario){

    console.warn(
        "Usuario aún no disponible. Reintentando cargar préstamos..."
    );

    setTimeout(
        () => {
            listarPrestamos();
        },
        500
    );

    return;

}


/*
    FILTRAR PRÉSTAMOS
    SEGÚN EL ROL DEL USUARIO
*/

let prestamosFiltrados = [];


/*
    ADMINISTRADOR

    Ve los préstamos que ya están
    cargados para su empresa.
*/

if(
    usuario.rol === "ADMINISTRADOR"
){

    prestamosFiltrados =
        DB.prestamos.filter(

            prestamo =>

                !prestamo.archivado &&

                prestamo.estado === "ACTIVO"

        );

}


/*
    COBRADOR

    Solo ve préstamos de los clientes
    asignados directamente a él.
*/

else if(
    usuario.rol === "COBRADOR"
){

    prestamosFiltrados =
        DB.prestamos.filter(

            prestamo => {

                if(
                    prestamo.archivado ||
                    prestamo.estado !== "ACTIVO"
                ){

                    return false;

                }


                /*
                    BUSCAR CLIENTE DEL PRÉSTAMO
                */

                const cliente =
                    DB.clientes.find(

                        c =>
                            Number(c.id) ===
                            Number(prestamo.clienteId)

                    );


                if(!cliente){

                    return false;

                }


                /*
                    MISMA REGLA UTILIZADA
                    EN LISTAR CLIENTES
                */

                return String(
                    cliente.usuarioAsignadoId
                ) === String(
                    usuario.id
                )

                &&

                cliente.estado === "ACTIVO";

            }

        );

}


/*
    MOSTRAR PRÉSTAMOS FILTRADOS
*/

prestamosFiltrados.forEach(prestamo=>{

        let cliente = DB.clientes.find(

            c=>c.id==prestamo.clienteId

        );

        let siguiente = prestamo.cronograma.find(

            x=>x.estado=="PENDIENTE"

        );

        tabla.innerHTML+=`

        <tr>

            <td>${prestamo.codigo}</td>

            <td>${cliente ? cliente.nombre : ""}</td>

            <td>${dinero(prestamo.capital)}</td>

            <td>${dinero(prestamo.saldoTotal)}</td>

            <td>${siguiente ? siguiente.fecha : "-"}</td>

            <td>

                <span class="badge bg-success">

                    ${prestamo.estado}

                </span>

            </td>

            <td>

                <td>

                <button
                    class="btn btn-primary btn-sm"
                    onclick="abrirCronograma(${prestamo.id})">

                    📅 Cronograma

                </button>

                ${prestamo.estado==="ACTIVO" ? `

                <button
                    class="btn btn-warning btn-sm"
                    onclick="abrirReestructuracion(${prestamo.id})">

                    🔄 Reestructurar

                </button>

                ` : ""}

                ${prestamo.estado==="FINALIZADO" && !prestamo.archivado ? `

                <button
                    class="btn btn-secondary btn-sm"
                    onclick="archivarPrestamo(${prestamo.id})">

                    📦 Archivar

                </button>

                ` : ""}

            </td>

            

        </tr>

        `;

    });

}

/*=========================================================
        VER CRONOGRAMA
=========================================================*/

function verCronograma(id){

    let prestamo = DB.prestamos.find(

        p=>p.id==id

    );

    

    if(!prestamo) return;

    let texto="";

    texto+="PRÉSTAMO: "+prestamo.codigo+"\\n\\n";

    prestamo.cronograma.forEach(c=>{

        texto+=

        "Cuota "+c.numero+

        " | "+c.fecha+

        " | "+dinero(c.valor)+

        " | "+c.estado+

        "\\n";

    });

    alert(texto);

}
/*=========================================================
        MODAL CRONOGRAMA
=========================================================*/

let modalCronograma;

async function abrirCronograma(id){

    let prestamo = DB.prestamos.find(

        p=>p.id==id

    );

    prestamo.cronograma =
        await obtenerCronogramaSupabase(
            prestamo.supabaseId
    );

    if(!prestamo){

        alert("No se encontró el préstamo.");

        return;

    }
    let cliente = DB.clientes.find(

    c => c.id == prestamo.clienteId

);

let cuotasPagadas = prestamo.cronograma.filter(

    c => c.estado == "PAGADA"

).length;

let cuotasPendientes = prestamo.cronograma.filter(

    c => c.estado != "PAGADA"

).length;

document.getElementById("resumenPrestamo").innerHTML = `

<div class="row">

    <div class="col-md-4">

        <strong>Cliente:</strong><br>

        ${cliente ? cliente.nombre : ""}

    </div>

    <div class="col-md-4">

        <strong>Préstamo:</strong><br>

        ${prestamo.codigo}

    </div>

    <div class="col-md-4">

        <strong>Estado:</strong><br>

        ${prestamo.estado}

    </div>

</div>

<hr>

<div class="row">

    <div class="col-md-3">

        <strong>Capital Prestado:</strong><br>

        ${dinero(prestamo.capital)}

    </div>

    <div class="col-md-3">

        <strong>Saldo Total:</strong><br>

        ${dinero(prestamo.saldoTotal)}

    </div>

    <div class="col-md-3">

        <strong>Capital Recuperado:</strong><br>

        ${dinero(prestamo.capitalRecuperado)}

    </div>

    <div class="col-md-3">

        <strong>Interés Recuperado:</strong><br>

        ${dinero(prestamo.interesRecuperado)}

    </div>

</div>

<hr>

<div class="row">

    <div class="col-md-6">

        <strong>Cuotas Pagadas:</strong><br>

        ${cuotasPagadas}

    </div>

    <div class="col-md-6">

        <strong>Cuotas Pendientes:</strong><br>

        ${cuotasPendientes}

    </div>

</div>
<hr>

<div class="d-flex gap-2 mt-3">

    <button
        class="btn btn-success"
        onclick="abrirPagoRapido(${prestamo.id})">

        💰 Registrar Pago

    </button>

    <button
        class="btn btn-warning"
        onclick="abrirReestructuracion(${prestamo.id})">

        🔄 Reestructurar

    </button>

</div>

`;
    if(!modalCronograma){

        modalCronograma = new bootstrap.Modal(

            document.getElementById("modalCronograma")

        );

    }

    cargarCronograma(prestamo);

    const elementoModalPago =
    document.getElementById("modalPago");

    if(elementoModalPago){

        const instanciaPago =
            bootstrap.Modal.getInstance(
                elementoModalPago
            );

        if(instanciaPago){

            instanciaPago.hide();

    }

}

    modalCronograma.show();

}

/*=========================================================
        CARGAR CRONOGRAMA
=========================================================*/

function cargarCronograma(prestamo){

    let tabla = document.getElementById("tablaCronograma");

    tabla.innerHTML="";

    prestamo.cronograma.forEach(cuota=>{

        let color="secondary";

        if(cuota.estado=="PAGADA"){

            color="success";

        }

        if(cuota.estado=="PARCIAL"){

            color="warning";

        }

        if(cuota.estado=="VENCIDA"){

            color="danger";

        }

        tabla.innerHTML += `

        <tr>

            <td>${cuota.numero}</td>

            <td>${cuota.fecha}</td>

            <td>${dinero(cuota.capital)}</td>

            <td>${dinero(cuota.interes)}</td>

            <td>${dinero(cuota.valor)}</td>

            <td>${dinero(cuota.pagado)}</td>

            <td>

                <span class="badge bg-${color}">

                    ${cuota.estado}

                </span>

            </td>

            <td>

                <button

                    class="btn btn-success btn-sm"

                    onclick="abrirPago(

                        ${prestamo.id},

                        ${cuota.numero}

                    )">

                    💰 Cobrar

                </button>

            </td>

        </tr>

        `;

    });

}
/*=========================================================
        BUSCAR PRESTAMO
=========================================================*/

function obtenerPrestamo(id){

    return DB.prestamos.find(

        p=>Number(p.id)===Number(id)

    );

}

/*=========================================================
        BUSCAR CLIENTE
=========================================================*/

function obtenerCliente(id){

    return DB.clientes.find(

        c=>Number(c.id)===Number(id)

    );

}


/*=========================================================
    MODAL PRESTAMO
=========================================================*/

let modalPrestamo;

function abrirModalPrestamo(){

    if(!modalPrestamo){

        modalPrestamo = new bootstrap.Modal(

            document.getElementById("modalPrestamo")

        );

    }

    cargarSelectClientes();

    limpiarFormularioPrestamo();

    calcularPrestamo();

    modalPrestamo.show();

}

function cerrarModalPrestamo(){

    if(modalPrestamo){

        modalPrestamo.hide();

    }

}

function limpiarFormularioPrestamo(){

    document.getElementById("capital").value="";

    document.getElementById("interes").value=5;

    document.getElementById("meses").value=12;

    document.getElementById("periodicidad").value="Mensual";

    document.getElementById("fechaPrestamo").value=hoy();

    document.getElementById("primerPago").value="";

    document.getElementById("observacionesPrestamo").value="";

    document.getElementById("cronogramaPreview").innerHTML="";

}

   
/*=========================================================
    NUEVO CREDITO DESDE LA LISTA DE CLIENTES
    RESTAURA LA RENOVACIÓN DE CRÉDITOS
=========================================================*/

async function nuevoCreditoCliente(clienteId) {

    const usuarioActual = typeof obtenerUsuarioActual === "function"
        ? obtenerUsuarioActual()
        : null;

    const rolActual = String(
        usuarioActual?.rol || ""
    ).trim().toUpperCase();

    // Validar permisos del usuario.
    if (!esAdministrador()) {

        try {

            const {
                data: { user },
                error: errorUsuario
            } = await supabaseClient.auth.getUser();

            if (errorUsuario || !user) {
                throw new Error(
                    "No se pudo identificar la sesión. Inicia sesión nuevamente."
                );
            }

            const { data: usuariosEmpresa, error: errorEmpresa } =
                await supabaseClient
                    .from("usuarios_empresa")
                    .select("id, empresa_id, rol, estado")
                    .eq("auth_user_id", user.id);

            if (errorEmpresa) {
                throw errorEmpresa;
            }

            const usuarioEmpresa = (usuariosEmpresa || []).find(u =>
                ["ACTIVO", "ACTIVE"].includes(
                    String(u.estado || "").trim().toUpperCase()
                ) &&
                ["COBRADOR", "ADMINISTRADOR", "ADMIN"].includes(
                    String(u.rol || "").trim().toUpperCase()
                )
            );

            if (!usuarioEmpresa) {
                console.error("Rol local:", rolActual);
                throw new Error(
                    "No se encontró un usuario activo con permisos."
                );
            }

            const empresaActiva = Number(
                DB.config?.licencia?.empresaId
            );

            if (
                empresaActiva &&
                Number(usuarioEmpresa.empresa_id) !== empresaActiva
            ) {
                throw new Error(
                    "El usuario no pertenece a la empresa activa."
                );
            }

        } catch (error) {

            console.error("Error validando permisos:", error);

            alert(
                error.message ||
                "No tienes permisos para continuar."
            );

            return;
        }
    }

    // Buscar cliente.
    const cliente = DB.clientes.find(
        c => Number(c.id) === Number(clienteId)
    );

    if (!cliente) {
        alert("No se encontró el cliente.");
        return;
    }

    if (
        String(cliente.estado || "").toUpperCase() !== "ACTIVO"
    ) {
        alert("El cliente debe estar activo.");
        return;
    }

    // Buscar créditos activos del cliente.
    const activos = DB.prestamos.filter(p =>
        Number(p.clienteId) === Number(cliente.id) &&
        String(p.estado || "").toUpperCase() === "ACTIVO" &&
        !p.archivado
    );

    if (activos.length > 1) {
        alert(
            "Se encontraron varios créditos activos para este cliente. " +
            "Revisa la cartera antes de continuar."
        );
        return;
    }

    // Limpiar cualquier renovación anterior y abrir el modal.
    ocultarPanelRenovacion();
    abrirModalPrestamo();

    const select = document.getElementById("prestamoCliente");

    if (!select) {
        alert("No se encontró el selector de clientes.");
        return;
    }

    select.value = String(cliente.id);

    select.dispatchEvent(
        new Event("change", { bubbles: true })
    );

    // Si no tiene crédito activo, es un crédito ordinario.
    if (activos.length === 0) {
        return;
    }

    const anterior = activos[0];

    if (!anterior.supabaseId) {
        cerrarModalPrestamo();

        alert(
            "El crédito anterior no está sincronizado con Supabase."
        );

        return;
    }

    try {

        // Recuperar el cronograma real desde Supabase.
        const cronograma = await obtenerCronogramaSupabase(
            anterior.supabaseId
        );

        if (!Array.isArray(cronograma) || cronograma.length === 0) {
            cerrarModalPrestamo();

            alert(
                "No fue posible consultar el cronograma del crédito anterior."
            );

            return;
        }

        // Restaurar la referencia de renovación.
        anterior.cronograma = cronograma;
        prestamoRenovacionActual = anterior;

        // Mostrar el panel de renovación.
        const panel = document.getElementById("panelRenovacion");

        if (panel) {
            panel.classList.remove("d-none");
        } else {
            console.error(
                "No se encontró el panelRenovacion en el HTML."
            );

            alert(
                "No se encontró el panel de renovación en el formulario."
            );

            return;
        }

        // Calcular saldo pendiente y dinero neto.
        actualizarResumenRenovacion();

    } catch (error) {

        console.error(
            "Error recuperando el crédito anterior:",
            error
        );

        cerrarModalPrestamo();

        alert(
            "No fue posible cargar la renovación.\n\n" +
            (error.message || error)
        );
    }
}


/***********************************************************
    AGREGAR PRÉSTAMO EN SUPABASE
***********************************************************/
async function agregarPrestamoSupabase(prestamo){

    const empresaId =
        DB.config?.licencia?.empresaId;

    if(!empresaId){

        alert("Empresa no identificada.");

        return null;

    }

    /*
        BUSCAR EL CLIENTE
        PARA OBTENER EL ID DE SUPABASE
    */

    const cliente =
        DB.clientes.find(
            c =>
                Number(c.id) ===
                Number(prestamo.clienteId)
        );

    if(!cliente){

        alert("Cliente no encontrado.");

        return null;

    }

    if(!cliente.supabaseId){

        alert("El cliente no está sincronizado con Supabase.");

        return null;

    }

    try{

        const nuevoPrestamo = {

            empresa_id: empresaId,

            local_id: prestamo.id,

            cliente_local_id: prestamo.clienteId,

            cliente_supabase_id: cliente.supabaseId,

            capital: prestamo.capital,

            interes: prestamo.interes,

            tipo_interes: prestamo.tipoInteres,

            meses: prestamo.meses,

            periodicidad: prestamo.periodicidad,

            fecha_prestamo: prestamo.fechaPrestamo,

            primer_pago: prestamo.primerPago,

            observaciones: prestamo.observaciones,

            interes_total: prestamo.interesTotal,

            total: prestamo.total,

            saldo_capital: prestamo.saldoCapital,

            saldo_total: prestamo.saldoTotal,

            capital_recuperado: prestamo.capitalRecuperado,

            interes_recuperado: prestamo.interesRecuperado,

            estado: prestamo.estado,

            archivado: prestamo.archivado,

            renovado_de_id: prestamo.renovadoDeId ?? null,
            monto_saldo_aplicado: prestamo.montoSaldoAplicado ?? 0,
            fecha_renovacion: prestamo.fechaRenovacion ?? null

        };

        console.count("INSERT PRESTAMO");

        console.log("Objeto enviado:", nuevoPrestamo);

        const {
            data,
            error
        } =
        await supabaseClient
            .from("prestamos")
            .insert(
                nuevoPrestamo
            )
            .select()
            .single();

        const codigo = "PRE-" + String(data.id).padStart(6, "0");

        const { error: errorCodigo } =
            await supabaseClient
                .from("prestamos")
                .update({
                    codigo: codigo
                })
                .eq("id", data.id);

        if(errorCodigo){

            console.error(
                "Error actualizando código del préstamo:",
                errorCodigo
            );

        }

        data.codigo = codigo;

        console.log("Respuesta:", data);


        if(error){

            console.error(error);

            alert(
                "No fue posible guardar el préstamo."
            );

            return null;

        }

        /*
            GUARDAR EL ID
            DE SUPABASE
        */

     prestamo.supabaseId = data.id;

    prestamo.codigo = data.codigo;

    console.log("Antes de guardar cronograma");
    console.log("ID Supabase:", data.id);
    console.log("Cronograma:", prestamo.cronograma);

    await guardarCronogramaSupabase(
        data.id,
        prestamo.cronograma
);

    console.log("Después de guardar cronograma");

    DB.prestamos.push(prestamo);

    DB.guardar();

    return prestamo;

    }catch(error){

        if (error) {
            console.error("Error completo:", error);
            console.error("Mensaje:", error.message);
            console.error("Detalles:", error.details);
            console.error("Hint:", error.hint);
            console.error("Código:", error.code);
}

        alert(
            "Error guardando préstamo."
        );

        return null;

    }

}

/***********************************************************
    GUARDAR CRONOGRAMA EN SUPABASE
***********************************************************/
async function guardarCronogramaSupabase(prestamoId, cronograma) {


    console.log("Entró a guardarCronogramaSupabase");
    console.log("Prestamo ID:", prestamoId);
    console.log("Cronograma recibido:", cronograma);
    try {

        const cuotas = cronograma.map(cuota => ({

            prestamo_id: prestamoId,

            numero: cuota.numero,

            fecha: cuota.fecha,

            capital: cuota.capital,

            interes: cuota.interes,

            valor: cuota.valor,

            saldo: cuota.saldo,

            pagado: cuota.pagado || 0,

            estado: cuota.estado || "PENDIENTE"

        }));

        console.log("Cuotas a insertar:", cuotas);

        const { data, error } = await supabaseClient
            .from("cronograma_prestamos")
            .insert(cuotas)
            .select();

        if (error) {
            console.error("Error cronograma:", error);
            return false;
        }

        console.log("Cronograma guardado:", data);

        return true;

    } catch (e) {

        console.error("Error:", e);
        return false;

    }

}
/*=========================================================
    CRUD PRESTAMOS
=========================================================*/

function agregarPrestamo(prestamo){

    prestamo.codigo =
        "PRE-" + String(DB.prestamos.length + 1).padStart(5,"0");

    DB.prestamos.push(prestamo);

    DB.guardar();

    return prestamo;

}
/*=========================================================
        ARCHIVAR PRESTAMO
=========================================================*/

function eliminarPrestamo(id){

    DB.prestamos = DB.prestamos.filter(

        p => Number(p.id) !== Number(id)

    );

    DB.guardar();

}

    listarPrestamos();

    actualizarDashboard();


/*=========================================================
        ACTUALIZAR VISTA PREVIA
=========================================================*/


document.addEventListener("DOMContentLoaded", () => {

    // BOTÓN PARA GUARDAR EL PRÉSTAMO
    const btn = document.getElementById("btnGuardarPrestamo");

    if (btn) {
        btn.addEventListener("click", guardarPrestamo);
    }

    // CONTROLES QUE RECALCULAN EL CRÉDITO
    const controles = [
        "capital",
        "interes",
        "meses",
        "periodicidad"
    ];

    controles.forEach(id => {
        const campo = document.getElementById(id);

        if (campo) {
            campo.addEventListener("input", calcularPrestamo);
            campo.addEventListener("change", calcularPrestamo);
        }
    });

    // ACTUALIZAR EL RESUMEN CUANDO CAMBIE EL CAPITAL
    const campoCapital = document.getElementById("capital");

    if (campoCapital) {
        campoCapital.addEventListener(
            "input",
            actualizarResumenRenovacion
        );

        campoCapital.addEventListener(
            "change",
            actualizarResumenRenovacion
        );
    }

});

/*=========================================================
        REESTRUCTURAR PRESTAMO
=========================================================*/

let modalReestructuracion;

function abrirReestructuracion(id){

    
    
     if(!esAdministrador()){

        alert(
            "No tiene permisos para reestructurar préstamos."
        );

        return;

    }

    let prestamo = obtenerPrestamo(id);

    if(!prestamo){

        alert("No se encontró el préstamo.");

        return;

    }

    let cliente = obtenerCliente(prestamo.clienteId);

    if(!modalReestructuracion){

        modalReestructuracion = new bootstrap.Modal(

            document.getElementById("modalReestructuracion")

        );

    }

    document.getElementById("resCliente").value =
        cliente ? cliente.nombre : "";

    document.getElementById("resCodigo").value =
        prestamo.codigo;

    document.getElementById("resEstado").value =
        prestamo.estado;

    document.getElementById("resCapital").value =
        dinero(prestamo.capital);

    document.getElementById("resSaldo").value =
        dinero(prestamo.saldoTotal);

    document.getElementById("resCapitalRec").value =
        dinero(prestamo.capitalRecuperado);

    document.getElementById("resInteresRec").value =
        dinero(prestamo.interesRecuperado);

      

    const fechaPagoTotal =
        document.getElementById("fechaPagoTotal");

    if(fechaPagoTotal){
        fechaPagoTotal.value = hoy();
}

    actualizarVistaPreviaReestructuracion(prestamo);

    // Mostrar el modal
    modalReestructuracion.show();

    // Evitar que el modal conserve el foco al cerrarse
    const modalElement = document.getElementById("modalReestructuracion");

    modalElement.addEventListener("hidden.bs.modal", function () {
        if (modalElement.contains(document.activeElement)) {
            document.activeElement.blur();
        }
    }, { once: true });

    }

/*=========================================================
        PAGO RAPIDO DESDE LA FICHA
=========================================================*/

function abrirPagoRapido(idPrestamo){

    let prestamo = obtenerPrestamo(idPrestamo);

    if(!prestamo){

        alert("No se encontró el préstamo.");

        return;

    }

    let cuota = prestamo.cronograma.find(

        c => c.estado != "PAGADA"

    );

    if(!cuota){

        alert("El préstamo ya está finalizado.");

        return;

    }

    abrirPago(

        idPrestamo,

        cuota.numero

    );

}
let prestamoReestructuracion = null;

/*=========================================================
    CALCULAR SALDO PROVISIONAL PARA REESTRUCTURACION
=========================================================*/
function calcularSaldoProvisional(prestamo){

    const capitalPendiente =
        Number(prestamo.saldoCapital || 0);

    const capitalInicial =
        Number(prestamo.capital || 0);

    const tasa =
        Number(prestamo.interes || 0);


    /*=========================================================
        FECHA ORIGINAL DEL CRÉDITO
    =========================================================*/

    const fechaPrestamo =
        prestamo.fechaPrestamo;


    if(!fechaPrestamo){

        return {

            capitalPendiente,
            capitalInicial,
            tasa,

            fechaInicio: null,
            fechaPagoTotal: hoy(),

            diasTranscurridos: 0,

            interesMensual: 0,
            interesProporcional: 0,

            saldoProvisional:
                capitalPendiente

        };
    }


    /*=========================================================
        FECHA DE PAGO TOTAL / FECHA DE CORTE
    =========================================================*/

    const campoFechaPagoTotal =
        document.getElementById(
            "fechaPagoTotal"
        );

    const fechaPagoTotal =
        campoFechaPagoTotal?.value ||
        hoy();


    /*=========================================================
        CONVERTIR FECHA ORIGINAL Y FECHA DE PAGO TOTAL
    =========================================================*/

    const fechaOriginal =
        new Date(
            fechaPrestamo + "T00:00:00"
        );

    const fechaFin =
        new Date(
            fechaPagoTotal + "T00:00:00"
        );


    /*=========================================================
        DÍA ANCLA DEL CRÉDITO

        Ejemplo:

        Crédito:
        08/05/2026

        Día ancla:
        8

        Los cortes serán:

        08/06
        08/07
        08/08
        08/09
        08/10
        etc.
    =========================================================*/

    const diaAncla =
        fechaOriginal.getDate();


    /*=========================================================
        DETERMINAR EL ÚLTIMO CORTE DE INTERÉS

        Buscamos el último día "8" que haya ocurrido
        antes o en la fecha de pago total.

        Ejemplo:

        Fecha pago total:
        17/09/2026

        Último corte:
        08/09/2026
    =========================================================*/

    let ultimoCorte =
        new Date(fechaFin);


    ultimoCorte.setDate(
        diaAncla
    );


    /*
        Si el día ancla todavía no ha ocurrido
        en el mes de la fecha de pago total,
        retrocedemos al mes anterior.
    */

    if(ultimoCorte > fechaFin){

        ultimoCorte.setMonth(
            ultimoCorte.getMonth() - 1
        );

        ultimoCorte.setDate(
            diaAncla
        );
    }


    /*=========================================================
        EVITAR QUE EL CORTE SEA ANTERIOR A LA FECHA ORIGINAL
    =========================================================*/

    if(ultimoCorte < fechaOriginal){

        ultimoCorte =
            new Date(fechaOriginal);
    }


    /*=========================================================
        CALCULAR DÍAS DESDE EL ÚLTIMO CORTE

        Ejemplo:

        Último corte:
        08/09/2026

        Fecha pago total:
        17/09/2026

        Resultado:
        9 días
    =========================================================*/

    let diasTranscurridos =
        Math.floor(
            (
                fechaFin -
                ultimoCorte
            ) /
            (1000 * 60 * 60 * 24)
        );


    diasTranscurridos =
        Math.max(
            diasTranscurridos,
            0
        );


    /*=========================================================
        INTERÉS MENSUAL

        Para interés fijo se utiliza SIEMPRE
        el CAPITAL INICIAL.

        No utilizamos el saldo pendiente.
    =========================================================*/

    const interesMensual =
        capitalInicial *
        (tasa / 100);


    /*=========================================================
        INTERÉS PROPORCIONAL

        Mes financiero = 30 días
    =========================================================*/

    const interesProporcional =
        interesMensual *
        (diasTranscurridos / 30);


    /*=========================================================
        SALDO A REESTRUCTURAR

        Capital pendiente
        +
        interés causado desde el último corte
    =========================================================*/

    const saldoProvisional =
        capitalPendiente +
        interesProporcional;


    /*=========================================================
        RESULTADO
    =========================================================*/

    return {

        capitalPendiente,

        capitalInicial,

        tasa,

        fechaInicio:
            ultimoCorte
                .toISOString()
                .substring(0,10),

        fechaPagoTotal,

        diasTranscurridos,

        interesMensual,

        interesProporcional,

        saldoProvisional
    };
}

function actualizarVistaPreviaReestructuracion(prestamo){

    if(prestamo){
        prestamoReestructuracion = prestamo;
    }

    if(!prestamoReestructuracion) return;


    /*=========================================================
        CALCULAR LIQUIDACIÓN TOTAL
    =========================================================*/

    const liquidacion =
        calcularSaldoProvisional(
            prestamoReestructuracion
        );


    


    /*=========================================================
        MOSTRAR ÚLTIMO CORTE
    =========================================================*/

    const campoUltimoCorte =
        document.getElementById("resUltimoCorte");

    if(campoUltimoCorte){

        campoUltimoCorte.value =
            liquidacion.fechaInicio || "";

    }


    /*=========================================================
        MOSTRAR DÍAS DE INTERÉS
    =========================================================*/

    const campoDias =
        document.getElementById("resDiasInteres");

    if(campoDias){

        campoDias.value =
            liquidacion.diasTranscurridos || 0;

    }


    /*=========================================================
        MOSTRAR INTERÉS CAUSADO
    =========================================================*/

    const campoInteres =
        document.getElementById("resInteresCausado");

    if(campoInteres){

        campoInteres.value =
            dinero(
                liquidacion.interesProporcional || 0
            );

    }


    /*=========================================================
        MOSTRAR TOTAL A PAGAR
    =========================================================*/

    const campoTotal =
        document.getElementById("resTotalPagar");

    if(campoTotal){

        campoTotal.value =
            dinero(
                liquidacion.saldoProvisional || 0
            );

    }


    /*=========================================================
        YA NO SE GENERAN CUOTAS

        La reestructuración es una liquidación
        para pago total.
    =========================================================*/

    const tabla =
        document.getElementById(
            "tablaReestructuracion"
        );


    if(tabla){

        tabla.innerHTML = `
            <tr>
                <td colspan="6"
                    class="text-center text-muted py-3">

                    El crédito será liquidado
                    completamente en la fecha
                    de pago acordada.

                </td>
            </tr>
        `;

    }

}



/***********************************************************
    GUARDAR REESTRUCTURACIÓN EN SUPABASE
***********************************************************/

async function guardarReestructuracionSupabase(prestamo, nuevoCronograma) {
    if (!prestamo?.supabaseId) {
        console.error("El préstamo no tiene ID de Supabase.");
        return false;
    }

    if (!Array.isArray(nuevoCronograma) || nuevoCronograma.length !== 1) {
        console.error("La liquidación debe tener una sola obligación.");
        return false;
    }

    const prestamoId = prestamo.supabaseId;
    let idsCronogramaAnterior = [];
    let cronogramaDesactivado = false;
    let prestamoActualizado = false;
    let datosOriginales = null;

    try {
        // 1. Consultar los campos básicos del préstamo.
        const consulta = await supabaseClient
            .from("prestamos")
            .select("interes, meses, periodicidad, primer_pago, interes_total, saldo_capital, saldo_total, estado")
            .eq("id", prestamoId)
            .maybeSingle();

        if (consulta.error) throw consulta.error;
        if (!consulta.data) {
            throw new Error("No se encontró el préstamo en Supabase.");
        }

        datosOriginales = consulta.data;

        // 2. Identificar el cronograma que está activo.
        const consultaCronograma = await supabaseClient
            .from("cronograma_prestamos")
            .select("id")
            .eq("prestamo_id", prestamoId)
            .eq("activo", true);

        if (consultaCronograma.error) throw consultaCronograma.error;

        idsCronogramaAnterior = (consultaCronograma.data || [])
            .map(cuota => cuota.id);

        // 3. Desactivar el cronograma anterior.
        if (idsCronogramaAnterior.length > 0) {
            const resultado = await supabaseClient
                .from("cronograma_prestamos")
                .update({ activo: false })
                .in("id", idsCronogramaAnterior);

            if (resultado.error) throw resultado.error;
            cronogramaDesactivado = true;
        }

        // 4. Actualizar el préstamo con campos ya utilizados por la aplicación.
        const actualizacion = await supabaseClient
            .from("prestamos")
            .update({
                interes: prestamo.interes,
                meses: prestamo.meses,
                periodicidad: prestamo.periodicidad,
                primer_pago: prestamo.primerPago,
                interes_total: prestamo.interesTotal,
                saldo_capital: prestamo.saldoCapital,
                saldo_total: prestamo.saldoTotal,
                estado: prestamo.estado
            })
            .eq("id", prestamoId)
            .select("id")
            .maybeSingle();

        if (actualizacion.error) throw actualizacion.error;
        if (!actualizacion.data) {
            throw new Error("Supabase no confirmó la actualización del préstamo.");
        }

        prestamoActualizado = true;

        // 5. Insertar la obligación de pago total.
        const cuota = nuevoCronograma[0];

        const insercion = await supabaseClient
            .from("cronograma_prestamos")
            .insert({
                prestamo_id: prestamoId,
                numero: 1,
                fecha: cuota.fecha,
                capital: Number(cuota.capital || 0),
                interes: Number(cuota.interes || 0),
                valor: Number(cuota.valor || 0),
                saldo: Number(cuota.saldo || 0),
                pagado: 0,
                estado: "PENDIENTE",
                activo: true
            })
            .select("id")
            .single();

        if (insercion.error) throw insercion.error;
        if (!insercion.data) {
            throw new Error("No se confirmó la creación de la obligación.");
        }

        cuota.id = insercion.data.id;
        console.log("Liquidación guardada en Supabase:", {
            prestamoId,
            cuotaId: cuota.id
        });

        return true;

    } catch (error) {
        console.error("Error guardando liquidación:", error);

        // Revertir la actualización del préstamo si alcanzó a realizarse.
        if (prestamoActualizado && datosOriginales) {
            const restauracion = await supabaseClient
                .from("prestamos")
                .update(datosOriginales)
                .eq("id", prestamoId);

            if (restauracion.error) {
                console.error("Error restaurando el préstamo:", restauracion.error);
            }
        }

        // Reactivar el cronograma anterior.
        if (cronogramaDesactivado && idsCronogramaAnterior.length > 0) {
            const restauracionCronograma = await supabaseClient
                .from("cronograma_prestamos")
                .update({ activo: true })
                .in("id", idsCronogramaAnterior);

            if (restauracionCronograma.error) {
                console.error(
                    "Error restaurando el cronograma:",
                    restauracionCronograma.error
                );
            }
        }

        return false;
    }
}
/*=========================================================
        GUARDAR REESTRUCTURACION
=========================================================*/

async function guardarReestructuracion(){
    /*=========================================================
        VALIDAR PERMISOS
    =========================================================*/

    if(!esAdministrador()){

        alert(
            "No tiene permisos para reestructurar préstamos."
        );

        return;
    }


    try{

        console.log("REESTRUCTURACIÓN: entró al bloque try");

        /*=====================================================
            VALIDAR PRÉSTAMO
        =====================================================*/

        if(!prestamoReestructuracion){

            alert(
                "No hay un préstamo seleccionado."
            );

            return;
        }


        const prestamo = prestamoReestructuracion;

        console.log("REESTRUCTURACIÓN: préstamo seleccionado =", prestamo);
        console.log("REESTRUCTURACIÓN: fecha de pago =", document.getElementById("fechaPagoTotal")?.value);
        console.log("REESTRUCTURACIÓN: antes de calcular liquidación");
        const prestamoOriginal = structuredClone(prestamo);

        /*=====================================================
            OBTENER FECHA DE PAGO TOTAL
        =====================================================*/

        const campoFechaPagoTotal =
            document.getElementById(
                "fechaPagoTotal"
            );


        const fechaPagoTotal =
            campoFechaPagoTotal?.value || "";


        if(!fechaPagoTotal){

            alert(
                "Seleccione la fecha de pago total."
            );

            return;
        }


        /*=====================================================
            CALCULAR LIQUIDACIÓN
        =====================================================*/

        const liquidacion =
            calcularSaldoProvisional(
                prestamo
            );
        console.log("REESTRUCTURACIÓN: liquidación calculada =", liquidacion);

        const capitalPendiente =
            Number(
                liquidacion.capitalPendiente || 0
            );


        const interesCausado =
            Number(
                liquidacion.interesProporcional || 0
            );


        const saldoProvisional =
            capitalPendiente +
            interesCausado;


        /*=====================================================
            VALIDAR SALDO
        =====================================================*/

        if(saldoProvisional <= 0){

            alert(
                "El préstamo no tiene saldo pendiente."
            );

            return;
        }


        /*=====================================================
            CONFIRMACIÓN DEL TOTAL
        =====================================================*/

        const confirmar =
            confirm(

                "LIQUIDACIÓN PARA PAGO TOTAL\n\n" +

                "Capital pendiente: " +
                dinero(capitalPendiente) +
                "\n\n" +

                "Interés causado: " +
                dinero(interesCausado) +
                "\n\n" +

                "TOTAL A PAGAR: " +
                dinero(saldoProvisional) +
                "\n\n" +

                "Fecha de pago total: " +
                fechaPagoTotal +
                "\n\n" +

                "¿Desea confirmar esta liquidación?"
            );


        if(!confirmar){

            return;
        }


        /*=====================================================
            CREAR HISTORIAL
        =====================================================*/

        if(
            !Array.isArray(
                prestamo.historialReestructuraciones
            )
        ){

            prestamo.historialReestructuraciones = [];

        }


        prestamo.historialReestructuraciones.push({

            fecha:
                hoy(),

            tipoOperacion:
                "PAGO_TOTAL",

            fechaPagoTotal:
                fechaPagoTotal,

            fechaUltimoCorte:
                liquidacion.fechaInicio,

            diasTranscurridos:
                liquidacion.diasTranscurridos,

            capitalOriginal:
                Number(
                    prestamo.capital || 0
                ),

            capitalPendiente:
                capitalPendiente,

            tasaOriginal:
                Number(
                    prestamo.interes || 0
                ),

            interesCausado:
                interesCausado,

            saldoReestructurado:
                saldoProvisional

        });


        /*=====================================================
            CREAR UNA ÚNICA OBLIGACIÓN DE PAGO TOTAL

            NO SE CREAN CUOTAS MENSUALES
            NO SE CREAN CUOTAS QUINCENALES
            NO SE GENERA INTERÉS NUEVO
        =====================================================*/

        const nuevoCronograma = [

            {

                numero:
                    1,

                fecha:
                    fechaPagoTotal,

                capital:
                    capitalPendiente,

                interes:
                    interesCausado,

                valor:
                    saldoProvisional,

                saldo:
                    saldoProvisional,

                pagado:
                    0,

                estado:
                    "PENDIENTE"

            }

        ];


        /*=====================================================
            ACTUALIZAR EL PRÉSTAMO

            CONSERVAMOS SUS CONDICIONES ORIGINALES.
            NO CAMBIAMOS PLAZO NI TASA.
        =====================================================*/

        prestamo.interesTotal =
            interesCausado;


        prestamo.saldoCapital =
            capitalPendiente;


        prestamo.saldoTotal =
            saldoProvisional;


        prestamo.cronograma =
            nuevoCronograma;


        prestamo.estado =
            "ACTIVO";


        prestamo.reestructurado =
            true;


        prestamo.fechaUltimaReestructuracion =
            hoy();


        prestamo.fechaPagoTotalReestructuracion =
            fechaPagoTotal;


        /*=====================================================
            SINCRONIZAR CON SUPABASE
        =====================================================*/
        const sincronizado =
            await guardarReestructuracionSupabase(
                prestamo,
                nuevoCronograma
            );
        console.log("RESULTADO DE SINCRONIZACIÓN:", sincronizado);
        console.log("ID SUPABASE DEL PRÉSTAMO:", prestamo.supabaseId);
        console.log("SALDO QUE SE INTENTA GUARDAR:", prestamo.saldoTotal);
        console.log("FECHA DE PAGO:", prestamo.fechaPagoTotalReestructuracion);


        if (!sincronizado) {
            Object.keys(prestamo).forEach(key => {
                delete prestamo[key];
            });

            Object.assign(prestamo, prestamoOriginal);

            DB.guardar();

            alert(
                "No fue posible guardar la liquidación en Supabase. " +
                "Se restauraron los datos locales del préstamo."
            );

            return;
        }


        /*=====================================================
            GUARDAR COPIA LOCAL
        =====================================================*/

        DB.guardar();


        /*=====================================================
            ACTUALIZAR INTERFAZ
        =====================================================*/

        listarPrestamos();

        actualizarDashboard();


        // Retirar el foco antes de ocultar el modal
        const modalElement = document.getElementById("modalReestructuracion");

        if (modalElement && modalElement.contains(document.activeElement)) {
            document.activeElement.blur();
        }

        modalReestructuracion.hide();


        prestamoReestructuracion =
            null;


        /*=====================================================
            CONFIRMACIÓN
        =====================================================*/

        alert(

            "Liquidación para pago total guardada correctamente.\n\n" +

            "Fecha de pago: " +
            fechaPagoTotal +
            "\n\n" +

            "Total a pagar: " +
            dinero(saldoProvisional) +
            "\n\n" +

            "El crédito queda pendiente de pago total."
        );


    }catch(error){

        console.error(
            "Error al guardar liquidación para pago total:",
            error
        );


        alert(

            "No fue posible guardar la liquidación:\n\n" +
            error.message

        );

    }

}

/***********************************************************
    OBTENER CRONOGRAMA ACTIVO DESDE SUPABASE
***********************************************************/
async function obtenerCronogramaSupabase(prestamoId){

    const {
        data,
        error
    } =
    await supabaseClient
        .from("cronograma_prestamos")
        .select("*")
        .eq(
            "prestamo_id",
            prestamoId
        )
        .eq(
            "activo",
            true
        )
        .order(
            "numero",
            {
                ascending:true
            }
        );

    if(error){

        console.error(
            "Error obteniendo cronograma:",
            error
        );

        return [];

    }

    return data || [];

}

/*=========================================================
    SOLICITUDES DE RENOVACIÓN
    CONSULTA, APROBACIÓN Y RECHAZO
=========================================================*/

let modalSolicitudesRenovacion = null;

// Escapar textos para evitar interpretar datos como HTML.
function escaparTextoRenovacion(valor) {
    return String(valor ?? "").replace(/[&<>"']/g, caracter => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[caracter]);
}

// Consultar las solicitudes de la empresa activa.
async function consultarSolicitudesRenovacion() {
    const empresaId = DB.config?.licencia?.empresaId;

    if (!empresaId) {
        throw new Error("No se identificó la empresa activa.");
    }

    const { data, error } = await supabaseClient
        .from("solicitudes_renovacion")
        .select("*")
        .eq("empresa_id", empresaId)
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Error consultando solicitudes:", error);
        throw error;
    }

    return data || [];
}

// Actualizar el contador que aparece en el botón.
async function actualizarContadorSolicitudesRenovacion() {
    const contador = document.getElementById(
        "contadorSolicitudesRenovacion"
    );

    if (!contador || !esAdministrador()) return;

    try {
        const solicitudes = await consultarSolicitudesRenovacion();

        const pendientes = solicitudes.filter(
            solicitud => solicitud.estado === "PENDIENTE"
        ).length;

        contador.textContent = pendientes;
    } catch (error) {
        console.error("No se pudo actualizar el contador:", error);
    }
}

// Abrir la ventana de solicitudes.
async function abrirSolicitudesRenovacion() {
    if (!esAdministrador()) {
        alert("Solo un administrador puede gestionar las solicitudes.");
        return;
    }

    const boton = document.getElementById("btnSolicitudesRenovacion");

    if (boton) boton.disabled = true;

    try {
        const solicitudes = await consultarSolicitudesRenovacion();

        let modalElemento = document.getElementById(
            "modalSolicitudesRenovacion"
        );

        // Crear el modal una sola vez.
        if (!modalElemento) {
            document.body.insertAdjacentHTML("beforeend", `
                <div class="modal fade"
                     id="modalSolicitudesRenovacion"
                     tabindex="-1"
                     aria-hidden="true">

                    <div class="modal-dialog modal-xl modal-dialog-scrollable">
                        <div class="modal-content">

                            <div class="modal-header">
                                <h5 class="modal-title">
                                    Solicitudes de renovación
                                </h5>

                                <button type="button"
                                        class="btn-close"
                                        data-bs-dismiss="modal"
                                        aria-label="Cerrar"></button>
                            </div>

                            <div class="modal-body">
                                <div id="contenidoSolicitudesRenovacion"></div>
                            </div>

                            <div class="modal-footer">
                                <button type="button"
                                        class="btn btn-secondary"
                                        data-bs-dismiss="modal">
                                    Cerrar
                                </button>
                            </div>

                        </div>
                    </div>
                </div>
            `);

            modalElemento = document.getElementById(
                "modalSolicitudesRenovacion"
            );

            modalSolicitudesRenovacion = new bootstrap.Modal(
                modalElemento
            );
        } else if (!modalSolicitudesRenovacion) {
            modalSolicitudesRenovacion = new bootstrap.Modal(
                modalElemento
            );
        }

        const contenedor = document.getElementById(
            "contenidoSolicitudesRenovacion"
        );

        if (!solicitudes.length) {
            contenedor.innerHTML = `
                <div class="alert alert-info mb-0">
                    No hay solicitudes de renovación registradas.
                </div>
            `;
        } else {
            const filas = await Promise.all(
                solicitudes.map(async solicitud => {
                    const cliente = DB.clientes.find(
                        c => String(c.supabaseId) ===
                            String(solicitud.cliente_id)
                    );

                    const prestamoAnterior = DB.prestamos.find(
                        p => String(p.supabaseId) ===
                            String(solicitud.prestamo_anterior_id)
                    );

                    const nombreCliente = cliente?.nombre ||
                        `Cliente ID ${solicitud.cliente_id}`;

                    const codigoPrestamo = prestamoAnterior?.codigo ||
                        `Crédito ID ${solicitud.prestamo_anterior_id}`;

                    const estado = String(
                        solicitud.estado || ""
                    ).toUpperCase();

                    const estadoClase = estado === "PENDIENTE"
                        ? "warning"
                        : estado === "APROBADA"
                            ? "success"
                            : estado === "RECHAZADA"
                                ? "danger"
                                : "secondary";

                    let acciones = "";

                    if (estado === "PENDIENTE") {
                        acciones = `
                            <button class="btn btn-success btn-sm"
                                onclick="decidirSolicitudRenovacion(
                                    ${Number(solicitud.id)}, 'APROBADA'
                                )">
                                Aprobar
                            </button>

                            <button class="btn btn-danger btn-sm"
                                onclick="decidirSolicitudRenovacion(
                                    ${Number(solicitud.id)}, 'RECHAZADA'
                                )">
                                Rechazar
                            </button>
                        `;
                    } else if (
                        estado === "APROBADA" &&
                        !solicitud.fecha_procesamiento
                    ) {
                        acciones = `
                            <button class="btn btn-primary btn-sm"
                                onclick="procesarSolicitudRenovacion(
                                    ${Number(solicitud.id)}
                                )">
                                Crear crédito renovado
                            </button>
                        `;
                    } else if (
                        estado === "APROBADA" &&
                        solicitud.prestamo_nuevo_id
                    ) {
                        acciones = `
                            <span class="text-success">
                                Crédito creado: ${escaparTextoRenovacion(
                                    solicitud.prestamo_nuevo_id
                                )}
                            </span>
                        `;
                    }

                    return `
                        <tr>
                            <td>${escaparTextoRenovacion(solicitud.id)}</td>

                            <td>${escaparTextoRenovacion(nombreCliente)}</td>

                            <td>${escaparTextoRenovacion(codigoPrestamo)}</td>

                            <td>${escaparTextoRenovacion(
                                dinero(solicitud.capital_solicitado)
                            )}</td>

                            <td>${escaparTextoRenovacion(
                                dinero(solicitud.saldo_aplicar)
                            )}</td>

                            <td>
                                <span class="badge text-bg-${estadoClase}">
                                    ${escaparTextoRenovacion(estado)}
                                </span>
                            </td>

                            <td>${escaparTextoRenovacion(
                                solicitud.created_at
                                    ? new Date(
                                        solicitud.created_at
                                    ).toLocaleString("es-CO")
                                    : ""
                            )}</td>

                            <td>${acciones}</td>
                        </tr>
                    `;
                })
            );

            contenedor.innerHTML = `
                <div class="table-responsive">
                    <table class="table table-bordered table-hover align-middle">
                        <thead>
                            <tr>
                                <th>Solicitud</th>
                                <th>Cliente</th>
                                <th>Crédito anterior</th>
                                <th>Nuevo capital</th>
                                <th>Saldo a aplicar</th>
                                <th>Estado</th>
                                <th>Fecha</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>

                        <tbody>
                            ${filas.join("")}
                        </tbody>
                    </table>
                </div>
            `;
        }

        await actualizarContadorSolicitudesRenovacion();
        modalSolicitudesRenovacion.show();

    } catch (error) {
        console.error("Error abriendo solicitudes:", error);

        alert(
            "No se pudieron consultar las solicitudes.\n\n" +
            (error.message || error)
        );
    } finally {
        if (boton) boton.disabled = false;
    }
}

// Aprobar o rechazar una solicitud mediante la función SQL existente.
async function decidirSolicitudRenovacion(id, decision) {
    if (!esAdministrador()) {
        alert("Solo un administrador puede tomar esta decisión.");
        return;
    }

    const decisionNormalizada = String(decision).toUpperCase();

    if (!["APROBADA", "RECHAZADA"].includes(decisionNormalizada)) {
        alert("La decisión indicada no es válida.");
        return;
    }

    let motivo = null;

    if (decisionNormalizada === "RECHAZADA") {
        motivo = prompt(
            "Indique el motivo del rechazo de la solicitud:"
        );

        if (motivo === null) return;

        motivo = motivo.trim();

        if (!motivo) {
            alert("Debe indicar el motivo del rechazo.");
            return;
        }
    } else {
        const confirmar = confirm(
            "¿Desea aprobar esta solicitud?\n\n" +
            "La aprobación no crea todavía el crédito nuevo. " +
            "Después deberá ejecutar el procesamiento."
        );

        if (!confirmar) return;
    }

    try {
        const { error } = await supabaseClient.rpc(
            "decidir_solicitud_renovacion",
            {
                p_solicitud_id: id,
                p_decision: decisionNormalizada,
                p_motivo: motivo
            }
        );

        if (error) throw error;

        alert(
            decisionNormalizada === "APROBADA"
                ? "Solicitud aprobada. Ahora puede procesar la renovación."
                : "Solicitud rechazada correctamente."
        );

        await abrirSolicitudesRenovacion();

    } catch (error) {
        console.error("Error decidiendo solicitud:", error);

        alert(
            "No fue posible actualizar la solicitud.\n\n" +
            (error.message || error)
        );
    }
}

// Crear el nuevo crédito y cerrar el anterior mediante la función SQL.
async function procesarSolicitudRenovacion(id) {
    if (!esAdministrador()) {
        alert("Solo un administrador puede procesar renovaciones.");
        return;
    }

    const confirmar = confirm(
        "Va a procesar la renovación aprobada.\n\n" +
        "Este proceso crea el crédito nuevo y cierra el anterior. " +
        "Verifique los datos antes de continuar.\n\n" +
        "¿Desea continuar?"
    );

    if (!confirmar) return;

    try {
        const { data, error } = await supabaseClient.rpc(
            "procesar_renovacion_aprobada",
            {
                p_solicitud_id: id
            }
        );

        if (error) throw error;

        // Actualizar los préstamos locales con los datos de Supabase.
        await cargarPrestamosSupabase();

        listarPrestamos();

        if (typeof actualizarDashboard === "function") {
            actualizarDashboard();
        }

        alert(
            "La renovación se procesó correctamente.\n\n" +
            "Respuesta de Supabase: " + JSON.stringify(data)
        );

        await abrirSolicitudesRenovacion();

    } catch (error) {
        console.error("Error procesando renovación:", error);

        alert(
            "No fue posible procesar la renovación.\n\n" +
            (error.message || error) +
            "\n\nRevise el estado de la solicitud en Supabase antes " +
            "de volver a intentarlo."
        );
    }
}

// Conectar el botón al abrir la página.
document.addEventListener("DOMContentLoaded", () => {
    const botonSolicitudes = document.getElementById(
        "btnSolicitudesRenovacion"
    );

    if (botonSolicitudes) {
        botonSolicitudes.addEventListener(
            "click",
            abrirSolicitudesRenovacion
        );
    }

    actualizarContadorSolicitudesRenovacion();
});


/*=========================================================
    SOLICITUDES DE CRÉDITO NUEVO
=========================================================*/

let modalSolicitudesCredito = null;

// Consultar solicitudes de la empresa activa.
async function consultarSolicitudesCredito() {
    const empresaId = Number(DB.config?.licencia?.empresaId);

    if (!empresaId) {
        throw new Error("No se identificó la empresa activa.");
    }

    const { data, error } = await supabaseClient
        .from("solicitudes_credito")
        .select("*")
        .eq("empresa_id", empresaId)
        .order("created_at", { ascending: false });

    if (error) throw error;

    return data || [];
}

// Actualizar el contador de solicitudes pendientes.
async function actualizarContadorSolicitudesCredito() {
    const contador = document.getElementById(
        "contadorSolicitudesCredito"
    );

    if (!contador || !esAdministrador()) return;

    try {
        const solicitudes = await consultarSolicitudesCredito();

        contador.textContent = solicitudes.filter(
            s => s.estado === "PENDIENTE"
        ).length;

    } catch (error) {
        console.error(
            "Error actualizando solicitudes de crédito:",
            error
        );
    }
}

// Mostrar las solicitudes en una ventana.
async function abrirSolicitudesCredito() {
    if (!esAdministrador()) {
        alert("Solo un administrador puede consultar las solicitudes.");
        return;
    }

    const boton = document.getElementById("btnSolicitudesCredito");

    if (boton) boton.disabled = true;

    try {
        const solicitudes = await consultarSolicitudesCredito();

        let elemento = document.getElementById(
            "modalSolicitudesCredito"
        );

        if (!elemento) {
            document.body.insertAdjacentHTML("beforeend", `
                <div class="modal fade"
                     id="modalSolicitudesCredito"
                     tabindex="-1"
                     aria-hidden="true">

                    <div class="modal-dialog modal-xl modal-dialog-scrollable">
                        <div class="modal-content">

                            <div class="modal-header">
                                <h5 class="modal-title">
                                    Solicitudes de crédito nuevo
                                </h5>

                                <button type="button"
                                        class="btn-close"
                                        data-bs-dismiss="modal"
                                        aria-label="Cerrar"></button>
                            </div>

                            <div class="modal-body">
                                <div id="contenidoSolicitudesCredito"></div>
                            </div>

                        </div>
                    </div>
                </div>
            `);

            elemento = document.getElementById(
                "modalSolicitudesCredito"
            );
        }

        if (!modalSolicitudesCredito) {
            modalSolicitudesCredito = new bootstrap.Modal(elemento);
        }

        const contenedor = document.getElementById(
            "contenidoSolicitudesCredito"
        );

        if (!solicitudes.length) {
            contenedor.innerHTML = `
                <div class="alert alert-info">
                    No hay solicitudes de crédito registradas.
                </div>
            `;
        } else {
            const filas = solicitudes.map(s => {
                const cliente = DB.clientes.find(
                    c => String(c.supabaseId) === String(s.cliente_id)
                );

                const estado = String(s.estado || "").toUpperCase();

                const clase = estado === "PENDIENTE"
                    ? "warning"
                    : estado === "APROBADA"
                        ? "success"
                        : "danger";

                const acciones = estado === "PENDIENTE"
                    ? `
                        <button class="btn btn-success btn-sm"
                            onclick="decidirSolicitudCredito(${Number(s.id)}, 'APROBADA')">
                            Aprobar
                        </button>

                        <button class="btn btn-danger btn-sm"
                            onclick="decidirSolicitudCredito(${Number(s.id)}, 'RECHAZADA')">
                            Rechazar
                        </button>
                    `
                    : "Sin acciones";

                return `
                    <tr>
                        <td>${Number(s.id)}</td>
                        <td>${escaparTextoRenovacion(
                            cliente?.nombre || "Cliente " + s.cliente_id
                        )}</td>
                        <td>${escaparTextoRenovacion(
                            dinero(s.capital_solicitado)
                        )}</td>
                        <td>${Number(s.meses_solicitados || 0)}</td>
                        <td>
                            <span class="badge text-bg-${clase}">
                                ${escaparTextoRenovacion(estado)}
                            </span>
                        </td>
                        <td>${escaparTextoRenovacion(
                            s.created_at
                                ? new Date(s.created_at).toLocaleString("es-CO")
                                : ""
                        )}</td>
                        <td>${acciones}</td>
                    </tr>
                `;
            });

            contenedor.innerHTML = `
                <div class="table-responsive">
                    <table class="table table-bordered table-hover align-middle">
                        <thead>
                            <tr>
                                <th>Solicitud</th>
                                <th>Cliente</th>
                                <th>Capital</th>
                                <th>Meses</th>
                                <th>Estado</th>
                                <th>Fecha</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>${filas.join("")}</tbody>
                    </table>
                </div>
            `;
        }

        await actualizarContadorSolicitudesCredito();
        modalSolicitudesCredito.show();

    } catch (error) {
        console.error("Error consultando solicitudes:", error);

        alert(
            "No fue posible consultar las solicitudes.\n\n" +
            (error.message || error)
        );
    } finally {
        if (boton) boton.disabled = false;
    }
}

// Conectar el botón.
document.addEventListener("DOMContentLoaded", () => {
    const boton = document.getElementById("btnSolicitudesCredito");

    if (boton) {
        boton.addEventListener("click", abrirSolicitudesCredito);
    }

    actualizarContadorSolicitudesCredito();
});


/*=========================================================
    APROBAR O RECHAZAR SOLICITUD DE CRÉDITO
=========================================================*/

async function decidirSolicitudCredito(id, decision) {

    if (!esAdministrador()) {
        alert("Solo un administrador puede decidir solicitudes.");
        return;
    }

    if (!["APROBADA", "RECHAZADA"].includes(decision)) {
        alert("La decisión no es válida.");
        return;
    }

    let motivo = null;

    if (decision === "RECHAZADA") {

        motivo = prompt(
            "Indica el motivo del rechazo (opcional):"
        );

        if (motivo === null) {
            return;
        }
    }

    const mensaje = decision === "APROBADA"
        ? "¿Confirmas que deseas aprobar esta solicitud y crear el préstamo?"
        : "¿Confirmas que deseas rechazar esta solicitud?";

    if (!confirm(mensaje)) {
        return;
    }

    const botones = document.querySelectorAll(
        `button[onclick*="decidirSolicitudCredito(${Number(id)}"]`
    );

    botones.forEach(boton => {
        boton.disabled = true;
    });

    try {

        const { data, error } = await supabaseClient.rpc(
            "decidir_solicitud_credito",
            {
                p_solicitud_id: Number(id),
                p_decision: decision,
                p_motivo: motivo
            }
        );

        if (error) {
            throw error;
        }

        if (!data || data.ok !== true) {
            throw new Error(
                "Supabase no confirmó la decisión."
            );
        }

        if (decision === "APROBADA") {

            alert(
                "Solicitud aprobada correctamente.\n\n" +
                "Código del préstamo: " + data.codigo + "\n" +
                "Cuotas creadas: " + data.cuotas_creadas
            );

        } else {

            alert("La solicitud fue rechazada correctamente.");

        }

        await abrirSolicitudesCredito();
        await actualizarContadorSolicitudesCredito();

    } catch (error) {

        console.error(
            "Error procesando solicitud de crédito:",
            error
        );

        alert(
            "No fue posible procesar la solicitud.\n\n" +
            (error.message || error)
        );

    } finally {

        botones.forEach(boton => {
            boton.disabled = false;
        });

    }
}