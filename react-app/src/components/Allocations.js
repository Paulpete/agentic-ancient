import React, { useState, useEffect } from 'react';
import './Allocations.css';

function Allocations() {
  const [allocations, setAllocations] = useState([]);

  useEffect(() => {
    // In a real application, you would fetch this data from an API.
    const dummyAllocations = [
      { id: 1, name: 'Allocation 1', amount: 1000 },
      { id: 2, name: 'Allocation 2', amount: 2000 },
      { id: 3, name: 'Allocation 3', amount: 3000 },
    ];
    setAllocations(dummyAllocations);
  }, []);

  return (
    <div className="Allocations">
      <h2>Allocations</h2>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          {allocations.map(allocation => (
            <tr key={allocation.id}>
              <td>{allocation.id}</td>
              <td>{allocation.name}</td>
              <td>{allocation.amount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default Allocations;
