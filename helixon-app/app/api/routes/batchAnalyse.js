import express from "express";

import orchestrate from "../../lib/cv-analysis/pipeline/orchestrator.js";

const router = express.Router();

router.post("/", async (req, res) => {

    const {

        cvs,

        job

    } = req.body;

    if (!Array.isArray(cvs))

        return res.status(400).json({

            error: "CV array required"

        });

    const results = [];

    for (const cv of cvs) {

        results.push(

            await orchestrate(cv, job)

        );

    }

    results.sort(

        (a, b) =>

        b.overall - a.overall

    );

    res.json(results);

});

export default router;