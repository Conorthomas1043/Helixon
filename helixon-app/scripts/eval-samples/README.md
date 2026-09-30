# Sample evaluation set

Fictional CVs and job descriptions - no real people - for checking scoring
without touching candidate data. Mainly for measuring run-to-run variance:

    ANTHROPIC_API_KEY=... VOYAGE_API_KEY=... npm run eval:cv -- scripts/eval-samples/cases.json --repeat 3

That's 6 cases × 3 runs, about 18 screenings (~$1.60). The expected
recommendations are a recruiter's reasonable call on these made-up CVs;
they're a sanity check, not ground truth. For real accuracy, use labelled
candidates: `npm run eval:labelled` and `npm run calibrate`.
