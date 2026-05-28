import { calculatePositionPrice, type PricingInput } from '../lib/pricing';

export function PricingPreview({ values, unit }: { values: PricingInput; unit?: string }) {
  const b = calculatePositionPrice(values);
  const qty = Number(values.quantity) || 0;
  const days = Number(values.days) || 0;

  return (
    <div className="pricing-preview panel">
      <h3 className="panel-title">Formula e llogaritjes</h3>
      <ul className="formula-list muted">
        <li>
          <strong>Materiali</strong> = sasia × çmimi materialit për njësi = {qty} × {values.materialPrice} ={' '}
          <span className="formula-val">{b.materialTotal.toFixed(2)} €</span>
        </li>
        <li>
          <strong>Puna</strong> = sasia × çmimi punës për njësi = {qty} × {values.laborPrice} ={' '}
          <span className="formula-val">{b.laborTotal.toFixed(2)} €</span>
        </li>
        <li>
          <strong>Ushqimi</strong> = ditë pune × ushqim ditor = {days} × {values.foodPrice} ={' '}
          <span className="formula-val">{b.foodTotal.toFixed(2)} €</span>
        </li>
        <li>
          <strong>Transporti</strong> = ditë pune × transport ditor = {days} × {values.transportPrice} ={' '}
          <span className="formula-val">{b.transportTotal.toFixed(2)} €</span>
        </li>
        <li>
          <strong>Tjera</strong> = shumë fikse (pa shumëzim) = <span className="formula-val">{b.otherTotal.toFixed(2)} €</span>
        </li>
      </ul>
      <div className="formula-summary">
        <p>
          Nëntotali = {b.materialTotal.toFixed(2)} + {b.laborTotal.toFixed(2)} + {b.foodTotal.toFixed(2)} +{' '}
          {b.transportTotal.toFixed(2)} + {b.otherTotal.toFixed(2)} = <strong>{b.subtotal.toFixed(2)} €</strong>
        </p>
        <p>
          Fitimi ({values.profitPercent}%) = {b.subtotal.toFixed(2)} × {values.profitPercent}% ={' '}
          <strong>{b.profitAmount.toFixed(2)} €</strong>
        </p>
        <p>
          TVSH ({values.vatPercent}%) = ({b.subtotal.toFixed(2)} + {b.profitAmount.toFixed(2)}) × {values.vatPercent}% ={' '}
          <strong>{b.vatAmount.toFixed(2)} €</strong>
        </p>
        <p className="formula-total">
          Totali = {b.subtotal.toFixed(2)} + {b.profitAmount.toFixed(2)} + {b.vatAmount.toFixed(2)} ={' '}
          <strong>{b.total.toFixed(2)} €</strong>
        </p>
        {qty > 0 && (
          <p className="muted">
            Çmimi për njësi ({unit || 'njësi'}) = {b.total.toFixed(2)} ÷ {qty} ={' '}
            <strong>{b.unitPrice.toFixed(2)} €</strong>
          </p>
        )}
      </div>
    </div>
  );
}
