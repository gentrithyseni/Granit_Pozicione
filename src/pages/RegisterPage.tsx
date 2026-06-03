import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Shell } from '../components/Shell';
import { PricingPreview } from '../components/PricingPreview';
import { pushAdjustLog } from '../lib/audit';
import { TRANSPORT_OPTIONS } from '../constants/transport';
import { PROJECT_STATUSES } from '../constants/projectStatus';
import { useToast } from '../context/ToastContext';
import { supabase } from '../lib/supabase';
import { ensureDefaultCategories } from '../services/categories';
import { saveRegisterRow, type RegisterFormValues } from '../services/register';
import type { DbCategory, DbProject } from '../types/database';

export function RegisterPage() {
  const { register, handleSubmit, watch, reset, setValue } = useForm<RegisterFormValues>({
    defaultValues: {
      projectId: '',
      newProjectName: '',
      newProjectClient: '',
      newProjectStatus: 'draft',
      categoryId: '',
      newCategoryName: '',
      description: '',
      unit: 'komplet',
      quantity: 1,
      materialPrice: 0,
      laborPrice: 0,
      days: 1,
      foodPrice: 0,
      location: 'Ferizaj',
      transportPrice: 10,
      otherPrice: 0,
      profitPercent: 0,
      vatPercent: 18,
    },
  });

  const [projects, setProjects] = useState<DbProject[]>([]);
  const [categories, setCategories] = useState<DbCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [savedResult, setSavedResult] = useState<{ unit: string; qty: number; price: number; total: number } | null>(null);
  const { showToast } = useToast();
  const [targetTotal, setTargetTotal] = useState('');
  const [mode, setMode] = useState<'proportional' | 'labor-first' | 'material-first'>('proportional');
  const [weight, setWeight] = useState(0.7);

  const watched = watch();
  const projectId = watched.projectId;
  const categoryId = watched.categoryId;
  const location = watched.location;

  const pricingInput = useMemo(
    () => ({
      quantity: watched.quantity,
      materialPrice: watched.materialPrice,
      laborPrice: watched.laborPrice,
      days: watched.days,
      foodPrice: watched.foodPrice,
      transportPrice: watched.transportPrice,
      otherPrice: watched.otherPrice,
      profitPercent: watched.profitPercent,
      vatPercent: watched.vatPercent,
    }),
    [watched]
  );

  const adjustLaborToTarget = (targetRaw?: string) => {
    const target = Number(targetRaw ?? targetTotal) || 0;
    const qty = Number(watched.quantity) || 0;
    const days = Number(watched.days) || 0;
    const materialTotal = qty * (Number(watched.materialPrice) || 0);
    const foodTotal = days * (Number(watched.foodPrice) || 0);
    const transportTotal = days * (Number(watched.transportPrice) || 0);
    const otherTotal = Number(watched.otherPrice) || 0;
    const profitPct = Number(watched.profitPercent) || 0;
    const vatPct = Number(watched.vatPercent) || 0;
    const K = (1 + profitPct / 100) * (1 + vatPct / 100);
    if (K <= 0 || qty <= 0) {
      showToast('Sasia duhet të jetë më e madhe se 0 për të përdorur këtë funksion.', 'error');
      return;
    }
    const targetSubtotal = target / K;
    const fixedOther = foodTotal + transportTotal + otherTotal;
    let adjustableNeeded = targetSubtotal - fixedOther;
    if (adjustableNeeded < 0) adjustableNeeded = 0;

    const laborTotal = qty * (Number(watched.laborPrice) || 0);
    const adjustableCurrent = materialTotal + laborTotal;
    if (adjustableCurrent > 0) {
      let newMaterialPerUnit = (Number(watched.materialPrice) || 0);
      let newLaborPerUnit = (Number(watched.laborPrice) || 0);
      if (mode === 'proportional') {
        const scale = adjustableNeeded / adjustableCurrent;
        newMaterialPerUnit = (Number(watched.materialPrice) || 0) * scale;
        newLaborPerUnit = (Number(watched.laborPrice) || 0) * scale;
      } else if (mode === 'labor-first') {
        const laborTargetTotal = adjustableNeeded * weight;
        const materialTargetTotal = Math.max(0, adjustableNeeded - laborTargetTotal);
        newLaborPerUnit = laborTargetTotal / qty;
        newMaterialPerUnit = materialTargetTotal / qty;
      } else if (mode === 'material-first') {
        const materialTargetTotal = adjustableNeeded * weight;
        const laborTargetTotal = Math.max(0, adjustableNeeded - materialTargetTotal);
        newMaterialPerUnit = materialTargetTotal / qty;
        newLaborPerUnit = laborTargetTotal / qty;
      }
      setValue('materialPrice', Number(newMaterialPerUnit.toFixed(2)), { shouldDirty: true });
      setValue('laborPrice', Number(newLaborPerUnit.toFixed(2)), { shouldDirty: true });
      showToast('Materiali dhe puna u rregulluan për targetin e dhënë.', 'success');

      // audit
      try {
        pushAdjustLog({
          source: 'register',
          mode,
          weight,
          target,
          before: { materialPrice: Number(watched.materialPrice) || 0, laborPrice: Number(watched.laborPrice) || 0 },
          after: { materialPrice: Number(newMaterialPerUnit) || 0, laborPrice: Number(newLaborPerUnit) || 0 },
          timestamp: new Date().toISOString(),
        });
      } catch (e) {}
    } else {
      // fallback: adjust labor only
      const neededLaborTotal = adjustableNeeded;
      const newLaborPerUnit = neededLaborTotal / qty;
      const finalLabor = Number(newLaborPerUnit) > 0 ? Number(newLaborPerUnit) : 0;
      setValue('laborPrice', Number(finalLabor.toFixed(2)), { shouldDirty: true });
      showToast('Puna u rregullua për targetin e dhënë (fallback).', 'success');
      try {
        pushAdjustLog({
          source: 'register',
          mode,
          weight,
          target,
          before: { materialPrice: Number(watched.materialPrice) || 0, laborPrice: Number(watched.laborPrice) || 0 },
          after: { materialPrice: Number(watched.materialPrice) || 0, laborPrice: Number(finalLabor) || 0 },
          timestamp: new Date().toISOString(),
        });
      } catch (e) {}
    }
  };

  useEffect(() => {
    async function load() {
      const cats = await ensureDefaultCategories();
      setCategories(cats);
      if (!supabase) return;
      const { data } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
      if (data) setProjects(data);
    }
    load();
  }, []);

  useEffect(() => {
    const option = TRANSPORT_OPTIONS.find((item) => item.name === location);
    if (option) setValue('transportPrice', option.price);
  }, [location, setValue]);

  const onSubmit = async (values: RegisterFormValues) => {
    // basic validation
    if (!values.description || String(values.description).trim() === '') {
      showToast('Vendosni një përshkrim për pozicionin.', 'error');
      return;
    }
    if (!values.quantity || Number(values.quantity) <= 0) {
      showToast('Sasia duhet të jetë më e madhe se 0.', 'error');
      return;
    }

    setLoading(true);
    try {
      const result = await saveRegisterRow(values);
      setSavedResult(result);
      const cats = await ensureDefaultCategories();
      setCategories(cats);
      reset({ ...values, description: '', newProjectName: '', newCategoryName: '' });
      showToast('Rreshti u ruajt me sukses.', 'success');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Gabim gjatë ruajtjes', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Shell>
      <div className="page-header">
        <h1>Regjistro</h1>
        <p className="muted">
          Materiali dhe puna shumëzohen me <strong>sasinë</strong>. Ushqimi dhe transporti shumëzohen vetëm me{' '}
          <strong>ditët e punës</strong>. Tjera është shumë fikse.
        </p>
      </div>

      

      {savedResult && (
        <div className="panel">
          <h3 className="panel-title">U ruajt</h3>
          <table className="import-table">
            <thead>
              <tr className="import-table-head-row">
                <th className="import-table-cell">Njësia</th>
                <th className="import-table-cell">Sasia</th>
                <th className="import-table-cell">Çmimi / njësi</th>
                <th className="import-table-cell">Gjithsej</th>
              </tr>
            </thead>
            <tbody>
              <tr className="import-table-body-row">
                <td className="import-table-cell">{savedResult.unit}</td>
                <td className="import-table-cell">{savedResult.qty}</td>
                <td className="import-table-cell">{savedResult.price}€</td>
                <td className="import-table-cell col-bold">{savedResult.total}€</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <form className="panel form-grid" onSubmit={handleSubmit(onSubmit)}>
        <label>
          Projekti
          <select {...register('projectId')}>
            <option value="">-- Zgjidh Projektin --</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>{project.name}</option>
            ))}
            <option value="NEW">+ Krijo Projekt të ri...</option>
          </select>
        </label>
        {projectId === 'NEW' && (
          <>
            <label>Emri i Projektit të Ri<input {...register('newProjectName')} placeholder="Shkruaj emrin..." /></label>
            <label>Klienti<input {...register('newProjectClient')} placeholder="Emri i klientit" /></label>
            <label>
              Statusi
              <select {...register('newProjectStatus')}>
                {PROJECT_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </label>
          </>
        )}

        <label>
          Kategoria
          <select {...register('categoryId')}>
            <option value="">-- Zgjidh Kategorinë --</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
            <option value="NEW">+ Kategori e re (emër tjetër)...</option>
          </select>
          <span className="field-hint">Zgjidh Pllaka, Ujë, Sanitari… — të gjitha pozicionet e së njëjtës kategorie grupohen tek Të dhënat.</span>
        </label>
        {categoryId === 'NEW' && (
          <label>
            Emri i Kategorisë së Re
            <input {...register('newCategoryName')} placeholder="Vetëm nëse nuk është në listë" />
          </label>
        )}

        <label className="full-width-field">
          Përshkrimi i punës
          <input {...register('description')} placeholder="p.sh. Shtrim pllaka 60x60 në banjo" />
        </label>
        <label>
          Njësia
          <select {...register('unit')}>
            <option value="m2">m²</option>
            <option value="m3">m³</option>
            <option value="m'">m'</option>
            <option value="copë">Copë</option>
            <option value="komplet">Komplet</option>
            <option value="paushall">Paushall</option>
            <option value="kg">kg</option>
            <option value="litër">Litër</option>
          </select>
        </label>
        <label>
          Sasia
          <input type="number" step="0.01" {...register('quantity', { valueAsNumber: true })} />
          <span className="field-hint">P.sh. 45 m² — përdoret për material & puna.</span>
        </label>

        <label>
          Materiali për njësi (€)
          <input type="number" step="0.01" {...register('materialPrice', { valueAsNumber: true })} />
          <span className="field-hint">Kostoja e materialeve (pllaka, çimento, tuba…) për 1 {watched.unit || 'njësi'}.</span>
        </label>
        <label>
          Puna për njësi (€)
          <input type="number" step="0.01" {...register('laborPrice', { valueAsNumber: true })} />
          <span className="field-hint">Kostoja e punës së dorës për 1 {watched.unit || 'njësi'}.</span>
        </label>

        <label>
          Ditë pune
          <input type="number" step="0.5" {...register('days', { valueAsNumber: true })} />
          <span className="field-hint">Sa ditë zgjat puna — përdoret vetëm për ushqim & transport.</span>
        </label>
        <label>
          Ushqim ditor (€)
          <input type="number" step="0.01" {...register('foodPrice', { valueAsNumber: true })} />
          <span className="field-hint">Çmimi për 1 ditë (× ditë pune, jo × sasia).</span>
        </label>
        <label>
          Lokacioni
          <select {...register('location')}>
            {TRANSPORT_OPTIONS.map((option) => (
              <option key={option.name} value={option.name}>{option.name}</option>
            ))}
          </select>
        </label>
        <label>
          Transport ditor (€)
          <input type="number" step="0.01" {...register('transportPrice', { valueAsNumber: true })} />
          <span className="field-hint">Çmimi transport për 1 ditë (× ditë pune).</span>
        </label>
        <label>
          Shpenzime tjera (€)
          <input type="number" step="0.01" {...register('otherPrice', { valueAsNumber: true })} />
          <span className="field-hint">Shumë totale fikse (p.sh. leje, mjete) — pa shumëzim.</span>
        </label>
        <label>
          Fitimi (%)
          <input type="number" step="0.01" {...register('profitPercent', { valueAsNumber: true })} />
        </label>
        <label>
          TVSH (%)
          <input type="number" step="0.01" {...register('vatPercent', { valueAsNumber: true })} />
        </label>
        <button className="primary-button register-submit-btn" type="submit" disabled={loading}>
          {loading ? 'Po ruhet...' : 'Llogarit dhe Ruaj Rreshtin'}
        </button>
      </form>

      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginTop: '1rem' }}>
        <label style={{ flex: 1 }}>
          Target total (€)
          <input
            placeholder="Target total (€)"
            value={targetTotal}
            onChange={(e) => setTargetTotal(e.target.value)}
            style={{ width: 140 }}
          />
        </label>
        <label>
          Mode
          <select value={mode} onChange={(e) => setMode(e.target.value as any)}>
            <option value="proportional">Proportional</option>
            <option value="labor-first">Labor-first</option>
            <option value="material-first">Material-first</option>
          </select>
        </label>
        <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          Weight
          <input type="range" min={0} max={1} step={0.05} value={weight} onChange={(e) => setWeight(Number(e.target.value))} />
          <small>{Math.round(weight * 100)}% labor</small>
        </label>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="button" className="card" onClick={() => adjustLaborToTarget()}>Adjust to target</button>
          <button type="button" className="card" onClick={() => { setTargetTotal(''); }}>Clear</button>
        </div>
      </div>
      
      <div style={{ marginTop: '1rem' }}>
        <PricingPreview values={pricingInput} unit={watched.unit} />
      </div>
    </Shell>
  );
}
