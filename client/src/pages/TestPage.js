import React from 'react';
import { useAuth } from '../contexts/AuthContext';

const TestPage = () => {
  const { user, loading } = useAuth();

  return (
    <div style={{ padding: '20px', background: 'white', minHeight: '100vh' }}>
      <h1>Test Page</h1>
      <p>Loading: {loading ? 'true' : 'false'}</p>
      <p>User: {user ? JSON.stringify(user, null, 2) : 'null'}</p>
      <p>Token: {localStorage.getItem('token') ? 'exists' : 'missing'}</p>
      <p>Current Path: {window.location.pathname}</p>
      
      <div style={{ marginTop: '20px' }}>
        <h2>Authentication Test</h2>
        <button onClick={() => {
          console.log('Current user:', user);
          console.log('Current token:', localStorage.getItem('token'));
        }}>
          Log Auth State
        </button>
      </div>
    </div>
  );
};

export default TestPage;



