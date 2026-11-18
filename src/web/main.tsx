import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { App } from './App.js';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('Missing root');
createRoot(root).render(<BrowserRouter><App /></BrowserRouter>);
