'use client';

const TIERS = [
  {
    id: 1,
    name: 'Essential',
    url: 'https://checkout.revolut.com/subscription/f92bd163-11be-478a-b099-0f3e9f79f1f6',
    button: 'Get Essential'
  },
  {
    id: 2,
    name: 'Premium',
    url: 'https://checkout.revolut.com/subscription/f26a5883-3dab-4dce-917f-293d55667f32',
    button: 'Get Premium Access'
  },
  {
    id: 3,
    name: 'Pro',
    url: 'https://checkout.revolut.com/subscription/4b2a1e27-98d4-4f4d-98b1-0b6cb9888c4e',
    button: 'Get Pro Access'
  },
];

export default function TierSelector() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '12px'
    }}>
      {TIERS.map((tier) => (
        <div key={tier.id} style={{
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          alignItems: 'stretch',
          width: '100%'
        }}>
          <a
            href={tier.url}
            style={{
              padding: '16px 20px',
              borderRadius: '999px',
              fontFamily: 'Arial',
              fontSize: '16px',
              fontWeight: 'normal',
              textDecoration: 'none',
              textAlign: 'center',
              cursor: 'pointer',
              width: '100%',
              boxSizing: 'border-box',
              background: '#00c4a7',
              color: '#ffffff',
              border: 'none',
              transition: 'opacity 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
          >
            {tier.button}
          </a>
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '6px',
            marginTop: '12px'
          }}>
            <img
              src="https://assets.revolut.com/assets/payment-schemes/Revolut-Dark.svg"
              height={22}
              alt="Revolut Pay"
            />
            <img
              src="https://assets.revolut.com/assets/payment-schemes/Visa.svg"
              height={22}
              alt="Visa"
            />
            <img
              src="https://assets.revolut.com/assets/payment-schemes/Amex.svg"
              height={22}
              alt="Amex"
            />
            <img
              src="https://assets.revolut.com/assets/payment-schemes/Mastercard.svg"
              height={22}
              alt="Mastercard"
            />
          </div>
        </div>
      ))}
    </div>
  );
}
