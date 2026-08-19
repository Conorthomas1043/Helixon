import React from 'react';

export default function CandidatePage({ params }) {
  const { id } = params || {};
  return (
    <div>
      <h1>Candidate {id}</h1>
      <p>Placeholder page for candidate {id}.</p>
    </div>
  );
}
