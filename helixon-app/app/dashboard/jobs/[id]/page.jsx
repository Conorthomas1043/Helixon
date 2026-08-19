import React from 'react';

export default function JobPage({ params }) {
  const { id } = params || {};
  return (
    <div>
      <h1>Job {id}</h1>
      <p>Placeholder page for job {id}.</p>
    </div>
  );
}
