import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Results from './pages/Results';
import DocumentViewer from './pages/DocumentViewer';
import StatsDashboard from './pages/StatsDashboard';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/results" element={<Results />} />
        <Route path="/document/:id" element={<DocumentViewer />} />
        <Route path="/stats" element={<StatsDashboard />} />
      </Routes>
    </Router>
  );
}

export default App;
