import React, { useState, useEffect } from 'react';
import './Sweeps.css';

function Sweeps() {
  const [sweeps, setSweeps] = useState([]);

  useEffect(() => {
    // In a real application, you would fetch this data from an API.
    const dummySweeps = [
      { id: 1, name: 'Sweep 1', amount: 100 },
      { id: 2, name: 'Sweep 2', amount: 200 },
      { id: 3, name: 'Sweep 3', amount: 300 },
    ];
    setSweeps(dummySweeps);
  }, []);

  return (
    <div className="Sweeps">
      <h2>Sweeps</h2>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          {sweeps.map(sweep => (
            <tr key={sweep.id}>
              <td>{sweep.id}</td>
              <td>{sweep.name}</td>
              <td>{sweep.amount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default Sweeps;
