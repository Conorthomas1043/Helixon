"use client";
export default function Success() {
  return (
    <main className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm
        border border-stone-200 p-8 text-center">
        <div className="text-5xl mb-4">n</div>
        <h1 className="text-2xl font-bold text-stone-900 mb-2">
          You're in!
        </h1>
        <p className="text-stone-500 text-sm mb-6">
          Your Helixon subscription is active. Start screening CVs in seconds.
        </p>
        <a href="/"
          className="block w-full bg-emerald-700 hover:bg-emerald-800 text-white
            font-medium py-3 rounded-lg text-center">
          Start using Helixon fi
        </a>
      </div>
    </main>
  );
}