/*=========================================================
    CREDICONTROL
    database.js
=========================================================*/

const STORAGE = {

    CLIENTES: "cc_clientes",

    PRESTAMOS: "cc_prestamos",

    PAGOS: "cc_pagos",

    CONFIG: "cc_config",

    USUARIOS: "cc_usuarios",

    SESION: "cc_sesion"

};


const DB = {

    clientes: [],

    prestamos: [],

    pagos: [],

    usuarios: [],

    sesion: null,

    config: {},


    /*=====================================================
        INICIAR BASE DE DATOS LOCAL
    =====================================================*/

    iniciar(){

        this.clientes =
            this.cargar(
                STORAGE.CLIENTES
            );


        this.prestamos =
            this.cargar(
                STORAGE.PRESTAMOS
            );


        this.pagos =
            this.cargar(
                STORAGE.PAGOS
            );


        /*=================================================
            USUARIOS
        =================================================*/

        this.usuarios =
            this.cargar(
                STORAGE.USUARIOS
            );


        if(
            !Array.isArray(
                this.usuarios
            )
        ){

            this.usuarios = [];

        }


        /*=================================================
            SESION
        =================================================*/

        try{

            this.sesion =
                JSON.parse(

                    localStorage.getItem(
                        STORAGE.SESION
                    )

                ) || null;

        }catch(error){

            this.sesion = null;

        }


        /*=================================================
            CONFIGURACION GUARDADA
        =================================================*/

        let configGuardada =
            this.cargar(
                STORAGE.CONFIG
            );


        if(
            !configGuardada ||
            Array.isArray(
                configGuardada
            )
        ){

            configGuardada = {};

        }


        /*=================================================
            ESTRUCTURA DE CONFIGURACION
        =================================================*/

        this.config = {


            /*=============================================
                LICENCIA CREDICONTROL
            =============================================*/

            licencia: {

                empresaId:

                    configGuardada
                        .licencia
                        ?.empresaId

                    ?? 1,


                codigoEmpresa:

                    configGuardada
                        .licencia
                        ?.codigoEmpresa

                    || "EMP-0001",


                estado:

                    configGuardada
                        .licencia
                        ?.estado

                    || "ACTIVA",


                cuposCobradores:

                    Number(

                        configGuardada
                            .licencia
                            ?.cuposCobradores

                        ?? 0

                    ),


                ultimaSincronizacion:

                    configGuardada
                        .licencia
                        ?.ultimaSincronizacion

                    || null

            },


            /*=============================================
                EMPRESA
            =============================================*/

            empresa: {

                nombre:

                    configGuardada
                        .empresa
                        ?.nombre

                    || "CrediControl",


                razonSocial:

                    configGuardada
                        .empresa
                        ?.razonSocial

                    || "",


                nit:

                    configGuardada
                        .empresa
                        ?.nit

                    || "",


                direccion:

                    configGuardada
                        .empresa
                        ?.direccion

                    || "",


                ciudad:

                    configGuardada
                        .empresa
                        ?.ciudad

                    || "",


                departamento:

                    configGuardada
                        .empresa
                        ?.departamento

                    || "",


                telefono:

                    configGuardada
                        .empresa
                        ?.telefono

                    || "",


                whatsapp:

                    configGuardada
                        .empresa
                        ?.whatsapp

                    || "",


                correo:

                    configGuardada
                        .empresa
                        ?.correo

                    || "",


                web:

                    configGuardada
                        .empresa
                        ?.web

                    || "",


                logo:

                    configGuardada
                        .empresa
                        ?.logo

                    || ""

            },


            /*=============================================
                RESPONSABLE
            =============================================*/

            responsable: {

                nombre:

                    configGuardada
                        .responsable
                        ?.nombre

                    || "",


                cargo:

                    configGuardada
                        .responsable
                        ?.cargo

                    || "",


                documento:

                    configGuardada
                        .responsable
                        ?.documento

                    || ""

            },


            /*=============================================
                PRESTAMOS
            =============================================*/

            prestamos: {

                interesDefault:

                    Number(

                        configGuardada
                            .prestamos
                            ?.interesDefault

                        ?? 5

                    ),


                moneda:

                    configGuardada
                        .prestamos
                        ?.moneda

                    || "COP",


                simbolo:

                    configGuardada
                        .prestamos
                        ?.simbolo

                    || "$",


                diasMes:

                    Number(

                        configGuardada
                            .prestamos
                            ?.diasMes

                        ?? 30

                    )

            },


            /*=============================================
                DOCUMENTOS
            =============================================*/

            documentos: {

                recibo:

                    Number(

                        configGuardada
                            .documentos
                            ?.recibo

                        ?? 1

                    ),


                contrato:

                    Number(

                        configGuardada
                            .documentos
                            ?.contrato

                        ?? 1

                    ),


                pagare:

                    Number(

                        configGuardada
                            .documentos
                            ?.pagare

                        ?? 1

                    ),


                estadoCuenta:

                    Number(

                        configGuardada
                            .documentos
                            ?.estadoCuenta

                        ?? 1

                    )

            }

        };

    },


    /*=====================================================
        CARGAR INFORMACION
    =====================================================*/

    cargar(clave){

        try{

            return JSON.parse(

                localStorage.getItem(
                    clave
                )

            ) || [];

        }catch(error){

            return [];

        }

    },


    /*=====================================================
        GUARDAR INFORMACION
    =====================================================*/

    guardar(){

        localStorage.setItem(

            STORAGE.CLIENTES,

            JSON.stringify(
                this.clientes
            )

        );


        localStorage.setItem(

            STORAGE.PRESTAMOS,

            JSON.stringify(
                this.prestamos
            )

        );


        localStorage.setItem(

            STORAGE.PAGOS,

            JSON.stringify(
                this.pagos
            )

        );


        localStorage.setItem(

            STORAGE.USUARIOS,

            JSON.stringify(
                this.usuarios
            )

        );


        localStorage.setItem(

            STORAGE.CONFIG,

            JSON.stringify(
                this.config
            )

        );

    },


    /*=====================================================
        LIMPIAR BASE DE DATOS
    =====================================================*/

    limpiar(){

        localStorage.clear();

        this.iniciar();

    }

};


/*=========================================================
    INICIAR CREDICONTROL
=========================================================*/

DB.iniciar();