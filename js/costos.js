
/* =====================================================
   BKC - COSTOS DE PRODUCCIÓN Y RECAUDO
   Registro y consulta de gastos por empresa/cobrador.
   No modifica pagos, préstamos ni reportes existentes.
===================================================== */

(function () {
    "use strict";

    const TABLA_GASTOS = "costos_recaudo";

    const CATEGORIAS = {
        GASOLINA: "Gasolina",
        ALMUERZO: "Almuerzo",
        MERIENDA: "Merienda",
        REPARACION_VARADA_MOTO: "Reparación / varada de moto",
        REPUESTOS_MANTENIMIENTO: "Repuestos / mantenimiento",
        GASTOS_VARIOS: "Gastos varios"
    };

    let perfilActual = null;
    let usuarioAuth = null;
    let cobradores = [];
    let inicializado = false;

    const $ = (id) => document.getElementById(id);

    function fechaLocalISO() {
        const ahora = new Date();
        const local = new Date(
            ahora.getTime() - ahora.getTimezoneOffset() * 60000
        );

        return local.toISOString().slice(0, 10);
    }

    function escaparHTML(valor) {
        return String(valor ?? "").replace(/[&<>"']/g, (caracter) => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[caracter]);
    }

    function formatoMoneda(valor) {
        return new Intl.NumberFormat("es-CO", {
            style: "currency",
            currency: "COP",
            maximumFractionDigits: 0
        }).format(Number(valor) || 0);
    }

    function mostrarMensaje(texto, tipo = "info") {
        const elemento = $("mensajeCostos");

        if (!elemento) return;

        elemento.className = `alert alert-${tipo}`;
        elemento.textContent = texto;
        elemento.classList.remove("d-none");
    }

    function ocultarMensaje() {
        const elemento = $("mensajeCostos");

        if (elemento) {
            elemento.classList.add("d-none");
        }
    }

    function normalizarRol(rol) {
        const valor = String(rol || "")
            .trim()
            .toUpperCase();

        return [
            "ADMIN",
            "ADMINISTRADOR",
            "ADMIN_EMPRESA"
        ].includes(valor)
            ? "ADMINISTRADOR"
            : valor;
    }

    function esAdmin() {
        return normalizarRol(perfilActual?.rol) === "ADMINISTRADOR";
    }

    function obtenerNombreCobrador(id) {
        const cobrador = cobradores.find(
            (item) => Number(item.id) === Number(id)
        );

        return cobrador?.nombre || `Cobrador #${id}`;
    }

    /* =====================================================
       IDENTIFICAR USUARIO Y EMPRESA EN SUPABASE
    ===================================================== */

    async function cargarPerfilAutenticado() {
        if (!window.supabaseClient) {
            throw new Error(
                "No se encontró supabaseClient. Verifica que supabase.js cargue antes de costos.js."
            );
        }

        const {
            data: authData,
            error: authError
        } = await window.supabaseClient.auth.getUser();

        if (authError) {
            throw authError;
        }

        if (!authData?.user) {
            throw new Error(
                "No hay una sesión autenticada en Supabase."
            );
        }

        usuarioAuth = authData.user;

        const {
            data: perfil,
            error: perfilError
        } = await window.supabaseClient
                .from("usuarios_empresa")
            .select(`
                id,
                usuario_id,
                nombre,
                correo,
                rol,
                estado,
                empresa_id,
                auth_user_id
            `)
            .eq("auth_user_id", usuarioAuth.id)
            .eq("estado", "ACTIVO")
            .single();

        if (perfilError) {
            throw perfilError;
        }

        if (!perfil?.id || !perfil?.empresa_id) {
            throw new Error(
                "No se encontró una relación activa entre el usuario y la empresa."
            );
        }

        const empresaLocal = Number(
            DB?.config?.licencia?.empresaId || 0
        );

        if (
            empresaLocal &&
            Number(perfil.empresa_id) !== empresaLocal
        ) {
            throw new Error(
                "La empresa de la sesión no coincide con la empresa configurada."
            );
        }

        perfilActual = perfil;


        console.log("BKC Costos - Perfil recibido:", perfilActual);
        console.log("BKC Costos - Rol normalizado:", normalizarRol(perfilActual.rol));

        return perfil;
    }

    /* =====================================================
       CARGAR COBRADORES ACTIVOS DE LA EMPRESA
    ===================================================== */

    async function cargarCobradores() {
        const {
            data,
            error
        } = await window.supabaseClient
                .from("usuarios_empresa")
            .select(`
                id,
                nombre,
                rol,
                estado,
                empresa_id
            `)
            .eq("empresa_id", perfilActual.empresa_id)
            .in("rol", ["COBRADOR", "ADMIN", "ADMINISTRADOR", "ADMIN_EMPRESA"])
            .eq("estado", "ACTIVO")
            .order("nombre", {
                ascending: true
            });

        if (error) {
            throw error;
        }

        cobradores = Array.isArray(data) ? data : [];

        const selectRegistro = $("cobradorGastoCostos");
        const selectFiltro = $("filtroCobradorCostos");

        if (selectRegistro) {
            selectRegistro.innerHTML =
                '<option value="">Seleccione cobrador...</option>' +
                cobradores.map((c) => `
                    <option value="${Number(c.id)}">
                        ${escaparHTML(c.nombre)}
                    </option>
                `).join("");
        }

        if (selectFiltro) {
            selectFiltro.innerHTML =
                '<option value="">Todos los cobradores</option>' +
                cobradores.map((c) => `
                    <option value="${Number(c.id)}">
                        ${escaparHTML(c.nombre)}
                    </option>
                `).join("");
        }
    }

    /* =====================================================
       PERMISOS VISUALES SEGÚN EL ROL
    ===================================================== */

    function aplicarPermisosVisuales() {
        const admin = esAdmin();

        const formulario = $("contenedorFormularioGasto");
        const filtroCobrador = $("contenedorFiltroCobradorCostos");
        const columnaAcciones = $("encabezadoAccionesGastos");
        const cobradorRegistro = $("contenedorCobradorGasto");

        if (formulario) {
            formulario.classList.toggle("d-none", !admin);
        }

        if (filtroCobrador) {
            filtroCobrador.classList.toggle("d-none", !admin);
        }

        if (columnaAcciones) {
            columnaAcciones.classList.toggle("d-none", !admin);
        }

        if (cobradorRegistro) {
            cobradorRegistro.classList.toggle("d-none", !admin);
        }

        if (!admin && perfilActual) {
            mostrarMensaje(
                "Modo consulta: puedes ver únicamente los gastos asociados a tu usuario.",
                "info"
            );
        }
    }

    /* =====================================================
       LIMPIAR FORMULARIO
    ===================================================== */

    function limpiarFormulario() {
        $("formularioGastoCostos")?.reset();

        $("idGastoCostos").value = "";
        $("fechaGastoCostos").value = fechaLocalISO();

        $("tituloFormularioGasto").textContent = "Registrar gasto";

        $("btnGuardarGastoCostos").innerHTML =
            '<i class="fa fa-save"></i> Guardar gasto';

        $("btnCancelarEdicionGastoCostos")
            .classList.add("d-none");
    }

    /* =====================================================
       PREPARAR EDICIÓN DE GASTO
    ===================================================== */

    function prepararEdicion(gasto) {
        if (!esAdmin()) {
            return;
        }

        $("idGastoCostos").value = gasto.id;

        $("fechaGastoCostos").value =
            gasto.fecha_gasto || fechaLocalISO();

        $("categoriaGastoCostos").value =
            gasto.categoria || "";

        $("conceptoGastoCostos").value =
            gasto.concepto || "";

        $("valorGastoCostos").value =
            Number(gasto.valor) || "";

        $("cobradorGastoCostos").value =
            String(gasto.cobrador_usuario_empresa_id || "");

        $("tituloFormularioGasto").textContent =
            "Modificar gasto";

        $("btnGuardarGastoCostos").innerHTML =
            '<i class="fa fa-save"></i> Guardar cambios';

        $("btnCancelarEdicionGastoCostos")
            .classList.remove("d-none");

        $("contenedorFormularioGasto").scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    }

    /* =====================================================
       REGISTRAR O ACTUALIZAR GASTO
    ===================================================== */

    async function guardarGasto(evento) {
        evento.preventDefault();
        ocultarMensaje();

        if (!esAdmin()) {
            mostrarMensaje(
                "Solo el administrador puede registrar o modificar gastos.",
                "warning"
            );
            return;
        }

        const id = $("idGastoCostos").value.trim();
        const fecha = $("fechaGastoCostos").value;
        const categoria = $("categoriaGastoCostos").value;
        const concepto = $("conceptoGastoCostos").value.trim();
        const valor = Number($("valorGastoCostos").value);
        const cobradorId = Number($("cobradorGastoCostos").value);

        if (
            !fecha ||
            !categoria ||
            !Number.isFinite(valor) ||
            valor <= 0 ||
            !Number.isInteger(cobradorId) ||
            cobradorId <= 0
        ) {
            mostrarMensaje(
                "Completa la fecha, categoría, valor y cobrador. El valor debe ser mayor que cero.",
                "warning"
            );
            return;
        }

        if (
            categoria === "GASTOS_VARIOS" &&
            !concepto
        ) {
            mostrarMensaje(
                "Para la categoría «Gastos varios», escribe el concepto del gasto.",
                "warning"
            );
            return;
        }

        const cobradorValido = cobradores.some(
            (c) => Number(c.id) === cobradorId
        );

        if (!cobradorValido) {
            mostrarMensaje(
                "El cobrador seleccionado no pertenece a esta empresa o no está activo.",
                "warning"
            );
            return;
        }

        const payload = {
            empresa_id: Number(perfilActual.empresa_id),

            // ID REAL de usuarios_empresa, no el ID local.
            cobrador_usuario_empresa_id: cobradorId,

            fecha_gasto: fecha,
            categoria: categoria,
            concepto: concepto || null,
            valor: Math.round(valor),
            updated_at: new Date().toISOString()
        };

        const boton = $("btnGuardarGastoCostos");
        boton.disabled = true;

        try {
            let resultado;

            if (id) {
                resultado = await supabaseClient
                    .from(TABLA_GASTOS)
                    .update(payload)
                    .eq("id", id)
                    .eq("empresa_id", perfilActual.empresa_id)
                    .select("id")
                    .single();
            } else {
                resultado = await supabaseClient
                    .from(TABLA_GASTOS)
                    .insert({
                        ...payload,
                        registrado_por: usuarioAuth.id
                    })
                    .select("id")
                    .single();
            }

            if (resultado.error) {
                throw resultado.error;
            }

            mostrarMensaje(
                id
                    ? "Gasto actualizado correctamente."
                    : "Gasto registrado correctamente.",
                "success"
            );

            limpiarFormulario();

            await consultarGastos();

        } catch (error) {
            console.error(
                "BKC Costos: error guardando gasto:",
                error
            );

            mostrarMensaje(
                `No fue posible guardar el gasto. ${
                    error?.message ||
                    "Verifica la conexión y las políticas de acceso de Supabase."
                }`,
                "danger"
            );

        } finally {
            boton.disabled = false;
        }
    }

    /* =====================================================
       CONSULTAR GASTOS
    ===================================================== */

    async function consultarGastos() {
        if (!perfilActual) {
            return;
        }

        const tbody = $("tablaGastosCostos");

        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center">
                    Consultando...
                </td>
            </tr>
        `;

        try {
            let consulta = supabaseClient
                .from(TABLA_GASTOS)
                .select(`
                    id,
                    empresa_id,
                    cobrador_usuario_empresa_id,
                    fecha_gasto,
                    categoria,
                    concepto,
                    valor,
                    registrado_por,
                    created_at,
                    updated_at
                `)
                .eq("empresa_id", perfilActual.empresa_id)
                .order("fecha_gasto", {
                    ascending: false
                })
                .order("created_at", {
                    ascending: false
                });

            const fechaInicio =
                $("fechaInicioListaCostos").value;

            const fechaFin =
                $("fechaFinListaCostos").value;

            if (fechaInicio) {
                consulta = consulta.gte(
                    "fecha_gasto",
                    fechaInicio
                );
            }

            if (fechaFin) {
                consulta = consulta.lte(
                    "fecha_gasto",
                    fechaFin
                );
            }

            if (esAdmin()) {
                const cobradorId =
                    $("filtroCobradorCostos").value;

                if (cobradorId) {
                    consulta = consulta.eq(
                        "cobrador_usuario_empresa_id",
                        Number(cobradorId)
                    );
                }
            } else {
                // El cobrador consulta solamente sus propios gastos.
                consulta = consulta.eq(
                    "cobrador_usuario_empresa_id",
                    Number(perfilActual.id)
                );
            }

            const {
                data,
                error
            } = await consulta;

            if (error) {
                throw error;
            }

            const gastos = Array.isArray(data) ? data : [];

            const total = gastos.reduce(
                (suma, gasto) =>
                    suma + (Number(gasto.valor) || 0),
                0
            );

            $("totalGastosCostos").textContent =
                formatoMoneda(total);

            if (!gastos.length) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="6"
                            class="text-center text-muted">
                            No hay gastos para los filtros seleccionados.
                        </td>
                    </tr>
                `;

                return;
            }

            tbody.innerHTML = gastos.map((gasto) => {
                const nombreCategoria =
                    CATEGORIAS[gasto.categoria] ||
                    gasto.categoria ||
                    "Sin categoría";

                const nombre = obtenerNombreCobrador(
                    gasto.cobrador_usuario_empresa_id
                );

                const acciones = esAdmin()
                    ? `
                        <td>
                            <button
                                type="button"
                                class="btn btn-sm btn-outline-primary btn-editar-gasto"
                                data-gasto-id="${escaparHTML(gasto.id)}">
                                Editar
                            </button>
                        </td>
                    `
                    : "";

                return `
                    <tr>
                        <td>
                            ${escaparHTML(gasto.fecha_gasto)}
                        </td>

                        <td>
                            ${escaparHTML(nombre)}
                        </td>

                        <td>
                            ${escaparHTML(nombreCategoria)}
                        </td>

                        <td>
                            ${escaparHTML(gasto.concepto || "—")}
                        </td>

                        <td class="text-end">
                            ${formatoMoneda(gasto.valor)}
                        </td>

                        ${acciones}
                    </tr>
                `;
            }).join("");

            tbody
                .querySelectorAll(".btn-editar-gasto")
                .forEach((boton) => {
                    boton.addEventListener("click", () => {
                        const gasto = gastos.find(
                            (item) =>
                                String(item.id) ===
                                boton.dataset.gastoId
                        );

                        if (gasto) {
                            prepararEdicion(gasto);
                        }
                    });
                });

        } catch (error) {
            console.error(
                "BKC Costos: error consultando gastos:",
                error
            );

            tbody.innerHTML = `
                <tr>
                    <td colspan="6"
                        class="text-center text-danger">
                        No fue posible consultar los gastos.
                        Verifica las políticas RLS y la conexión.
                    </td>
                </tr>
            `;

            mostrarMensaje(
                `Error consultando gastos: ${
                    error?.message || "error desconocido"
                }`,
                "danger"
            );
        }
    }

    
/* =====================================================
   CRUCE DE RECAUDO BRUTO, GASTOS Y PRODUCCIÓN NETA
===================================================== */

function fechaValidaCostos(valor) {
    return /^\d{4}-\d{2}-\d{2}$/.test(valor || "");
}

function normalizarNombreCostos(nombre) {
    return String(nombre || "")
        .trim()
        .toLocaleLowerCase("es-CO");
}

function obtenerFechasCruceCostos() {
    const tipo = $("tipoPeriodoCostos").value;
    let inicio = $("fechaInicioCostos").value;
    let fin = $("fechaFinCostos").value;

    const hoy = fechaLocalISO();

    if (tipo === "diario") {
        inicio = inicio || hoy;
        fin = fin || inicio;
    } else if (tipo === "semanal") {
        if (!inicio && !fin) {
            const fecha = new Date(`${hoy}T12:00:00`);
            const dia = (fecha.getDay() + 6) % 7;
            fecha.setDate(fecha.getDate() - dia);
            inicio = fecha.toISOString().slice(0, 10);
            fin = hoy;
        } else if (!inicio) {
            inicio = fin;
        } else if (!fin) {
            fin = hoy;
        }
    } else if (tipo === "mensual") {
        if (!inicio && !fin) {
            inicio = hoy.slice(0, 7) + "-01";
            fin = hoy;
        } else if (!inicio) {
            inicio = fin.slice(0, 7) + "-01";
        } else if (!fin) {
            fin = hoy;
        }
    }

    $("fechaInicioCostos").value = inicio;
    $("fechaFinCostos").value = fin;

    if (
        !fechaValidaCostos(inicio) ||
        !fechaValidaCostos(fin) ||
        inicio > fin
    ) {
        throw new Error("Selecciona un período de fechas válido.");
    }

    return { inicio, fin };
}

async function generarCruceIngresosNetos() {
    const boton = $("btnCruceIngresosNetos");
    const resultado = $("resultadoCruceCostos");

    if (!perfilActual || !resultado) {
        return;
    }

    if (boton) boton.disabled = true;

    resultado.innerHTML =
        '<p class="text-muted">Calculando recaudo y gastos...</p>';

    try {
        const { inicio, fin } = obtenerFechasCruceCostos();

        // Consultar los gastos directamente desde Supabase.
        let consultaGastos = window.supabaseClient
            .from(TABLA_GASTOS)
            .select("cobrador_usuario_empresa_id, fecha_gasto, valor")
            .eq("empresa_id", perfilActual.empresa_id)
            .gte("fecha_gasto", inicio)
            .lte("fecha_gasto", fin);

        // El cobrador solo consulta sus propios datos.
        if (!esAdmin()) {
            consultaGastos = consultaGastos.eq(
                "cobrador_usuario_empresa_id",
                perfilActual.id
            );
        }

        const { data: gastos, error: errorGastos } =
            await consultaGastos;

        if (errorGastos) throw errorGastos;

        // La colección local corresponde a los pagos de la empresa activa.
        const pagosPeriodo = (DB.pagos || []).filter((pago) => {
            const fecha = String(pago.fecha || "").slice(0, 10);
            return fecha >= inicio && fecha <= fin;
        });

        const listaCobradores = esAdmin()
            ? cobradores
            : [{
                id: perfilActual.id,
                nombre: perfilActual.nombre
            }];

        const resultados = listaCobradores.map((cobrador) => {
            const idCobrador = Number(cobrador.id);
            const nombreCobrador = normalizarNombreCostos(
                cobrador.nombre
            );

            const pagosCobrador = pagosPeriodo.filter((pago) => {
                const pagoId = pago.usuarioId ?? pago.usuario_id;
                const pagoNombre = normalizarNombreCostos(
                    pago.usuarioNombre || pago.usuario
                );

                if (
                    pagoId !== undefined &&
                    pagoId !== null &&
                    String(pagoId) !== ""
                ) {
                    return String(pagoId) === String(cobrador.usuario_id ?? idCobrador)
                        || String(pagoId) === String(idCobrador);
                }

                return pagoNombre !== "" &&
                    pagoNombre === nombreCobrador;
            });

            const gastosCobrador = (gastos || []).filter(
                (gasto) =>
                    Number(gasto.cobrador_usuario_empresa_id) ===
                    idCobrador
            );

            const recaudo = pagosCobrador.reduce(
                (total, pago) => total + (Number(pago.valor) || 0),
                0
            );

            const totalGastos = gastosCobrador.reduce(
                (total, gasto) => total + (Number(gasto.valor) || 0),
                0
            );

            return {
                nombre: cobrador.nombre,
                recaudo,
                gastos: totalGastos,
                neto: recaudo - totalGastos
            };
        });

        const totalRecaudo = resultados.reduce(
            (total, fila) => total + fila.recaudo,
            0
        );

        const totalGastos = resultados.reduce(
            (total, fila) => total + fila.gastos,
            0
        );

        const totalNeto = totalRecaudo - totalGastos;

        const filas = resultados.map((fila) => `
            <tr>
                <td>${escaparHTML(fila.nombre)}</td>
                <td class="text-end">${formatoMoneda(fila.recaudo)}</td>
                <td class="text-end">${formatoMoneda(fila.gastos)}</td>
                <td class="text-end fw-bold">${formatoMoneda(fila.neto)}</td>
            </tr>
        `).join("");

        resultado.innerHTML = `
            <div class="row g-3 mb-4">
                <div class="col-md-4">
                    <div class="card h-100">
                        <div class="card-body">
                            <div class="text-muted">Recaudo bruto</div>
                            <h5>${formatoMoneda(totalRecaudo)}</h5>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="card h-100">
                        <div class="card-body">
                            <div class="text-muted">Total de gastos</div>
                            <h5>${formatoMoneda(totalGastos)}</h5>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="card h-100">
                        <div class="card-body">
                            <div class="text-muted">Producción neta</div>
                            <h5>${formatoMoneda(totalNeto)}</h5>
                        </div>
                    </div>
                </div>
            </div>

            <p class="text-muted">
                Período: ${escaparHTML(inicio)} al ${escaparHTML(fin)}
            </p>

            <div class="table-responsive">
                <table class="table table-striped table-hover align-middle">
                    <thead>
                        <tr>
                            <th>Cobrador</th>
                            <th class="text-end">Recaudo bruto</th>
                            <th class="text-end">Gastos</th>
                            <th class="text-end">Producción neta</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filas || `
                            <tr>
                                <td colspan="4" class="text-center">
                                    No hay cobradores ni datos para el período.
                                </td>
                            </tr>
                        `}
                    </tbody>
                    <tfoot>
                        <tr class="fw-bold">
                            <td>TOTAL EMPRESA</td>
                            <td class="text-end">${formatoMoneda(totalRecaudo)}</td>
                            <td class="text-end">${formatoMoneda(totalGastos)}</td>
                            <td class="text-end">${formatoMoneda(totalNeto)}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        `;
    } catch (error) {
        console.error("BKC Costos: error en el cruce:", error);

        resultado.innerHTML = `
            <div class="alert alert-danger">
                No fue posible calcular el cruce:
                ${escaparHTML(error.message || "Error desconocido")}
            </div>
        `;
    } finally {
        if (boton) boton.disabled = false;
    }
}


    /* =====================================================
       CONFIGURAR EVENTOS
    ===================================================== */

    function configurarEventos() {
        $("formularioGastoCostos")?.addEventListener(
            "submit",
            guardarGasto
        );

        $("btnCancelarEdicionGastoCostos")?.addEventListener(
            "click",
            limpiarFormulario
        );

        $("btnConsultarGastosCostos")?.addEventListener(
            "click",
            consultarGastos
        );

        $("filtroCobradorCostos")?.addEventListener(
            "change",
            consultarGastos
        );

        $("btnCruceIngresosNetos")?.addEventListener(
            "click",
            generarCruceIngresosNetos
        );
    }

    /* =====================================================
       INICIALIZAR MÓDULO
    ===================================================== */

    async function inicializarModuloCostos() {
        const pantalla = $("costos");

        if (!pantalla || inicializado) {
            return;
        }

        inicializado = true;

        try {
            configurarEventos();
            limpiarFormulario();

            $("fechaInicioListaCostos").value =
                fechaLocalISO().slice(0, 8) + "01";

            $("fechaFinListaCostos").value =
                fechaLocalISO();

            await cargarPerfilAutenticado();
            await cargarCobradores();

            aplicarPermisosVisuales();

            await consultarGastos();

            console.log(
                "BKC Costos: módulo inicializado correctamente."
            );

        } catch (error) {
            console.error(
                "BKC Costos: no fue posible inicializar el módulo:",
                error
            );

            mostrarMensaje(
                `No fue posible iniciar el módulo de costos. ${
                    error?.message ||
                    "Verifica que exista una sesión activa en Supabase."
                }`,
                "danger"
            );

            const tbody = $("tablaGastosCostos");

            if (tbody) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="6"
                            class="text-center text-muted">
                            No se pudo cargar el módulo.
                        </td>
                    </tr>
                `;
            }
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            inicializarModuloCostos
        );
    } else {
        inicializarModuloCostos();
    }

})();
