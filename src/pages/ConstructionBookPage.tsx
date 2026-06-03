import { useState, useEffect } from 'react';
import { FileDown, BookOpen, ChevronLeft, Settings, AlertCircle } from 'lucide-react';
import { generateAndDownload, ConstructionBookConfig } from '../lib/constructionBook';
import { getProjects, getProjectWithItems, buildBookConfig, ProjectWithItems } from '../services/constructionBookService';

export default function ConstructionBookPage() {
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [projectData, setProjectData] = useState<ProjectWithItems | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string>('');

  // Konfigurimi i librit (mund të editohet nga përdoruesi)
  const [config, setConfig] = useState({
    month: '',
    executor_name: 'MEGRANT ING SH.P.K',
    section_title: 'V. PUNIMET TË TJERA',
    unit_label: 'm²',
    max_positions_per_page: 4
  });

  const [showConfig, setShowConfig] = useState(false);

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    if (selectedProjectId) {
      loadProjectData(selectedProjectId);
    } else {
      setProjectData(null);
    }
  }, [selectedProjectId]);

  async function loadProjects() {
    try {
      const data = await getProjects();
      setProjects(data);
    } catch (err: any) {
      setError('Gabim në ngarkimin e projekteve: ' + err.message);
    }
  }

  async function loadProjectData(projectId: string) {
    setLoading(true);
    setError('');
    try {
      const data = await getProjectWithItems(projectId);
      setProjectData(data);

      // Përditëso konfigurimin automatikisht
      if (data) {
        const autoConfig = buildBookConfig(data, config);
        setConfig(prev => ({
          ...prev,
          month: autoConfig.month,
          section_title: autoConfig.section_title,
          unit_label: autoConfig.unit_label
        }));
      }
    } catch (err: any) {
      setError('Gabim në ngarkimin e të dhënave: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleGenerate() {
    if (!projectData || projectData.items.length === 0) {
      setError('Projekti nuk ka pozicione për të gjeneruar librin.');
      return;
    }

    setGenerating(true);
    setError('');

    try {
      const bookConfig: ConstructionBookConfig = {
        month: config.month,
        executor_name: config.executor_name,
        building_name: projectData.name || projectData.description || 'Objekti',
        section_title: config.section_title,
        section_number: config.section_title.split('.')[0] || 'V',
        unit_label: config.unit_label,
        offer_account: `No ${config.section_title.split('.')[0] || 'V'}`,
        offer_positions: `No ${projectData.items.map(i => i.position_number).filter(Boolean).join(', ')}`,
        positions: projectData.items.map(item => ({
          position_number: item.position_number,
          description: item.description,
          unit: item.unit,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.total_price
        })),
        max_positions_per_page: config.max_positions_per_page
      };

      const filename = `Libri_Ndertimor_${projectData.name.replace(/\s+/g, '_')}.xlsx`;
      generateAndDownload(bookConfig, filename);
    } catch (err: any) {
      setError('Gabim në gjenerimin e librit: ' + err.message);
    } finally {
      setGenerating(false);
    }
  }

  const totalPages = projectData 
    ? Math.ceil(projectData.items.length / config.max_positions_per_page) 
    : 0;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center gap-3 mb-8">
        <BookOpen className="w-8 h-8 text-blue-600" />
        <h1 className="text-2xl font-bold text-gray-900">Libri Ndërtimor</h1>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      )}

      {/* Zgjedhja e projektit */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Zgjidh Projektin (Paramasën)
        </label>
        <select
          value={selectedProjectId}
          onChange={(e) => setSelectedProjectId(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">-- Zgjidh një projekt --</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {loading && (
        <div className="text-center py-8 text-gray-500">
          <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-3"></div>
          Duke ngarkuar pozicionet...
        </div>
      )}

      {projectData && !loading && (
        <>
          {/* Statistika */}
          <div className="bg-blue-50 rounded-lg p-4 mb-6 border border-blue-100">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-blue-600 font-medium">{projectData.name}</p>
                <p className="text-lg font-bold text-blue-900">
                  {projectData.items.length} pozicione | {totalPages} faqe të parashikuara
                </p>
              </div>
              <button
                onClick={() => setShowConfig(!showConfig)}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-blue-200 rounded-lg text-blue-700 hover:bg-blue-50 transition-colors"
              >
                <Settings className="w-4 h-4" />
                {showConfig ? 'Mbyll' : 'Konfigurimi'}
              </button>
            </div>
          </div>

          {/* Konfigurimi */}
          {showConfig && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
              <h3 className="font-semibold text-gray-900 mb-4">Parametrat e Librit Ndërtimor</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Muaji</label>
                  <input
                    type="text"
                    value={config.month}
                    onChange={(e) => setConfig({ ...config, month: e.target.value })}
                    placeholder="p.sh. GUSHT 2025"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Kryerësi i punëve</label>
                  <input
                    type="text"
                    value={config.executor_name}
                    onChange={(e) => setConfig({ ...config, executor_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Titulli i seksionit</label>
                  <input
                    type="text"
                    value={config.section_title}
                    onChange={(e) => setConfig({ ...config, section_title: e.target.value })}
                    placeholder="p.sh. V. PUNIMET TË TJERA"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Njësia matëse</label>
                  <input
                    type="text"
                    value={config.unit_label}
                    onChange={(e) => setConfig({ ...config, unit_label: e.target.value })}
                    placeholder="p.sh. m², komplet, copë"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max pozicione për faqe (1-5)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={config.max_positions_per_page}
                    onChange={(e) => setConfig({ ...config, max_positions_per_page: Math.min(5, Math.max(1, Number(e.target.value))) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Përshkrimet e gjata zvogëlohen automatikisht
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Parashikimi i pozicioneve */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-6">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h3 className="font-semibold text-gray-900">Pozicionet që do të përfshihen</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Nr.</th>
                    <th className="px-4 py-3 text-left font-medium">Përshkrimi</th>
                    <th className="px-4 py-3 text-left font-medium">Njësia</th>
                    <th className="px-4 py-3 text-right font-medium">Sasia</th>
                    <th className="px-4 py-3 text-right font-medium">Çmimi</th>
                    <th className="px-4 py-3 text-right font-medium">Totali</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {projectData.items.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{item.position_number}</td>
                      <td className="px-4 py-3 text-gray-700 max-w-md truncate">{item.description}</td>
                      <td className="px-4 py-3 text-gray-600">{item.unit}</td>
                      <td className="px-4 py-3 text-right text-gray-900">{item.quantity.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right text-gray-900">{item.unit_price.toFixed(2)}€</td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">{item.total_price.toFixed(2)}€</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Butoni i gjenerimit */}
          <div className="flex justify-end">
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              {generating ? (
                <>
                  <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></div>
                  Duke gjeneruar...
                </>
              ) : (
                <>
                  <FileDown className="w-5 h-5" />
                  Gjenero dhe Shkarko Librin Ndërtimor
                </>
              )}
            </button>
          </div>
        </>
      )}
    </div>
  );
}