import React from 'react';
import { useAuth } from '../contexts/AuthContext';

const DebugInfo = () => {
  const { user, loading } = useAuth();

  return (
    <div style={{ 
      position: 'fixed', 
      top: 0, 
      left: 0, 
      background: 'rgba(0,0,0,0.8)', 
      color: 'white', 
      padding: '10px', 
      zIndex: 9999,
      fontSize: '12px',
      maxWidth: '300px'
    }}>
      <h4>Debug Info:</h4>
      <p>Loading: {loading ? 'true' : 'false'}</p>
      <p>User: {user ? JSON.stringify(user, null, 2) : 'null'}</p>
      <p>Token: {localStorage.getItem('token') ? 'exists' : 'missing'}</p>
      <p>Current Path: {window.location.pathname}</p>
    </div>
  );
};

export default DebugInfo;



