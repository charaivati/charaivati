import { useEffect, useState } from 'react';

export default function Home() {
  const [states, setStates] = useState([]);

  useEffect(() => {
    fetch('/api/get-states')
      .then(res => res.json())
      .then(data => setStates(data));
  }, []);

  return (
    <div>
      <h1>States</h1>
      <ul>
        {states.map(state => (
          <li key={state.id}>{state.name} - {state.shape}</li>
        ))}
      </ul>
    </div>
  );
}
