/*=========================================================
    CREDICONTROL
    configuracion.js
=========================================================*/


/*=========================================================
    GUARDAR CONFIGURACION
=========================================================*/

function guardarConfiguracion(){

     

    try{


        if(!esAdministrador()){

        alert(
            "No tiene permisos para reestructurar préstamos."
        );

        return;

    }

        /* EMPRESA */

        DB.config.empresa.nombre =
            document.getElementById("empresa").value.trim();

        DB.config.empresa.razonSocial =
            document.getElementById("razonSocial").value.trim();

        DB.config.empresa.nit =
            document.getElementById("nitEmpresa").value.trim();

        DB.config.empresa.direccion =
            document.getElementById("direccionEmpresa").value.trim();

        DB.config.empresa.ciudad =
            document.getElementById("ciudadEmpresa").value.trim();

        DB.config.empresa.departamento =
            document.getElementById("departamentoEmpresa").value.trim();

        DB.config.empresa.telefono =
            document.getElementById("telefonoEmpresa").value.trim();

        DB.config.empresa.whatsapp =
            document.getElementById("whatsappEmpresa").value.trim();

        DB.config.empresa.correo =
            document.getElementById("correoEmpresa").value.trim();

        DB.config.empresa.web =
            document.getElementById("webEmpresa").value.trim();


        /* RESPONSABLE */

        DB.config.responsable.nombre =
            document.getElementById("responsableNombre").value.trim();

        DB.config.responsable.cargo =
            document.getElementById("responsableCargo").value.trim();

        DB.config.responsable.documento =
            document.getElementById("responsableDocumento").value.trim();


        /* CONFIGURACION FINANCIERA */

        DB.config.prestamos.interesDefault =
            Number(
                document.getElementById("interesDefault").value
            );

        DB.config.prestamos.moneda =
            document.getElementById("monedaDefault").value;

        DB.config.prestamos.diasMes =
            Number(
                document.getElementById("diasMesFinanciero").value
            );


        /* GUARDAR EN LOCALSTORAGE */

        DB.guardar();


        alert(
            "Configuración guardada correctamente."
        );


    }catch(error){

        console.error(
            "Error guardando configuración:",
            error
        );

        alert(
            "No fue posible guardar la configuración."
        );

    }

}


/*=========================================================
    CARGAR CONFIGURACION
=========================================================*/

function cargarConfiguracion(){

    if(!DB.config) return;


    /* EMPRESA */

    document.getElementById("empresa").value =
        DB.config.empresa?.nombre || "";

    document.getElementById("razonSocial").value =
        DB.config.empresa?.razonSocial || "";

    document.getElementById("nitEmpresa").value =
        DB.config.empresa?.nit || "";

    document.getElementById("direccionEmpresa").value =
        DB.config.empresa?.direccion || "";

    document.getElementById("ciudadEmpresa").value =
        DB.config.empresa?.ciudad || "";

    document.getElementById("departamentoEmpresa").value =
        DB.config.empresa?.departamento || "";

    document.getElementById("telefonoEmpresa").value =
        DB.config.empresa?.telefono || "";

    document.getElementById("whatsappEmpresa").value =
        DB.config.empresa?.whatsapp || "";

    document.getElementById("correoEmpresa").value =
        DB.config.empresa?.correo || "";

    document.getElementById("webEmpresa").value =
        DB.config.empresa?.web || "";


    /* RESPONSABLE */

    document.getElementById("responsableNombre").value =
        DB.config.responsable?.nombre || "";

    document.getElementById("responsableCargo").value =
        DB.config.responsable?.cargo || "";

    document.getElementById("responsableDocumento").value =
        DB.config.responsable?.documento || "";


    /* CONFIGURACION FINANCIERA */

    document.getElementById("interesDefault").value =
        DB.config.prestamos?.interesDefault ?? 5;

    document.getElementById("monedaDefault").value =
        DB.config.prestamos?.moneda || "COP";

    document.getElementById("diasMesFinanciero").value =
        DB.config.prestamos?.diasMes ?? 30;

}


/*=========================================================
    BOTON GUARDAR
=========================================================*/

document.addEventListener(
    "DOMContentLoaded",
    function(){

        const boton =
            document.getElementById(
                "btnGuardarConfiguracion"
            );

        if(boton){

            boton.addEventListener(
                "click",
                guardarConfiguracion
            );

        }


        /* CARGAR DATOS GUARDADOS */

        cargarConfiguracion();

    }
);
/*=========================================================
    GENERAR CONSECUTIVO DE RECIBO
=========================================================*/

function generarConsecutivoRecibo(){

    if(!DB.config.documentos){

        DB.config.documentos = {};

    }

    let numero =
        Number(DB.config.documentos.recibo || 1);

    const codigo =
        "RC-" +
        String(numero).padStart(6,"0");

    // Incrementar para el próximo recibo
    DB.config.documentos.recibo =
        numero + 1;

    return codigo;

}
/*=========================================================
    LOGO EMPRESARIAL
=========================================================*/

document.addEventListener(
    "DOMContentLoaded",
    function(){

        const inputLogo =
            document.getElementById("logoEmpresa");

        const preview =
            document.getElementById("previewLogoEmpresa");

        const sinLogo =
            document.getElementById("sinLogoEmpresa");


        if(!inputLogo) return;


        inputLogo.addEventListener(
            "change",
            function(event){

                const archivo =
                    event.target.files[0];

                if(!archivo) return;


                if(
                    archivo.type !== "image/png" &&
                    archivo.type !== "image/jpeg"
                ){

                    alert(
                        "Seleccione una imagen PNG o JPG."
                    );

                    inputLogo.value = "";

                    return;

                }


                const lector =
                    new FileReader();


                lector.onload =
                    function(e){

                        const imagenBase64 =
                            e.target.result;


                        /* GUARDAR TEMPORALMENTE EN CONFIG */

                        DB.config.empresa.logo =
                            imagenBase64;


                        /* MOSTRAR VISTA PREVIA */

                        preview.src =
                            imagenBase64;

                        preview.style.display =
                            "block";

                        sinLogo.style.display =
                            "none";

                    };


                lector.readAsDataURL(
                    archivo
                );

            }

        );


        /* CARGAR LOGO EXISTENTE */

        if(DB.config.empresa.logo){

            preview.src =
                DB.config.empresa.logo;

            preview.style.display =
                "block";

            sinLogo.style.display =
                "none";

        }

    }
);