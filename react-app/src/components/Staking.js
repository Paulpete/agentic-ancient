import React, { useState, useEffect } from 'react';
import './Staking.css';

function Staking() {
  const [staking, setStaking] = useState([]);

  useEffect(() => {
    // In a real application, you would fetch this data from an API.
    const dummyStaking = [
      { id: 1, name: 'Staking 1', amount: 500 },
      { id: 2, name: 'Staking 2', amount: 1000 },
      { id: 3, name: 'Staking 3', amount: 1500 },
    ];
    setStaking(dummyStaking);
  }, []);

  return (
    <div className="Staking">
      <h2>Staking</h2>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          {staking.map(stake => (
            <tr key={stake.id}>
              <td>{stake.id}</td>
              <td>{stake.name}</td>
              <td>{stake.amount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default Staking;
