import express from "express";

import orchestrate from "../../lib/cv-analysis/pipeline/orchestrator.js";


const router = express.Router();


router.post("/", async (req, res) => {

    try {

        const { cv, job } = req.body;


        console.log(
            "ANALYSE ROUTE CV TYPE:",
            typeof cv
        );

        console.log(
            "ANALYSE ROUTE CV LENGTH:",
            cv?.length
        );

        console.log(
            "ANALYSE ROUTE JOB TYPE:",
            typeof job
        );

        console.log(
            "ANALYSE ROUTE JOB LENGTH:",
            job?.length
        );


        if (!cv || !job) {

            return res.status(400).json({

                error: "Missing CV or Job Description"

            });

        }


        if (typeof cv !== "string") {

            return res.status(400).json({

                error: "CV must be plain text"

            });

        }


        if (typeof job !== "string") {

            return res.status(400).json({

                error: "Job description must be plain text"

            });

        }


        const result = await orchestrate(

            cv,

            job

        );


        return res.json({

            success: true,

            result

        });


    } catch (err) {


        console.error(
            "[analyse route error]",
            err
        );


        return res.status(500).json({

            error: err.message

        });


    }

});


export default router;