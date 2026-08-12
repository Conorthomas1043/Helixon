const DEFAULT_BENCHMARKS = {

    poor: 35,

    average: 55,

    good: 70,

    excellent: 85

};

export function benchmark(score) {

    let percentile = 10;

    let category = "Poor";

    if (score >= DEFAULT_BENCHMARKS.average) {

        percentile = 50;
        category = "Average";

    }

    if (score >= DEFAULT_BENCHMARKS.good) {

        percentile = 75;
        category = "Strong";

    }

    if (score >= DEFAULT_BENCHMARKS.excellent) {

        percentile = 90;
        category = "Excellent";

    }

    return {

        score,

        percentile,

        category,

        recommendation:

            score >= 85
                ? "Interview Immediately"
                : score >= 70
                ? "Interview"
                : score >= 55
                ? "Consider"
                : "Reject"

    };

}