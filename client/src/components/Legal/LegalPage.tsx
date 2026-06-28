import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import TradingKitIcon from '~/components/svg/TradingKitIcon';

const UPDATED = 'June 28, 2026';

function LegalShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-screen w-full overflow-y-auto bg-surface-primary text-text-primary">
      <div className="mx-auto max-w-3xl px-5 py-10">
        <Link
          to="/c/new"
          className="mb-8 inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary"
        >
          <ArrowLeft className="h-4 w-4" /> Back to TradingKit
        </Link>
        <div className="mb-6 flex items-center gap-2">
          <TradingKitIcon className="h-7 w-7 text-text-primary" />
          <span className="text-lg font-semibold">TradingKit</span>
        </div>
        <h1 className="mb-1 text-2xl font-bold">{title}</h1>
        <p className="mb-8 text-sm text-text-secondary">Last updated: {UPDATED}</p>
        <div className="space-y-5 text-sm leading-relaxed text-text-primary [&_h2]:mt-7 [&_h2]:text-base [&_h2]:font-semibold [&_p]:text-text-secondary [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5 [&_ul]:text-text-secondary [&_a]:text-blue-500 [&_a]:underline">
          {children}
        </div>
        <div className="mt-12 border-t border-border-light pt-5 text-xs text-text-secondary">
          <Link to="/terms" className="underline">
            Terms of Service
          </Link>
          {' · '}
          <Link to="/privacy" className="underline">
            Privacy Policy
          </Link>
        </div>
      </div>
    </div>
  );
}

export function TermsPage() {
  return (
    <LegalShell title="Terms of Service">
      <p>
        These Terms govern your use of TradingKit (the “Service”) at chat.tradingkit.com. By
        creating an account or using the Service, you agree to these Terms.
      </p>

      <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-text-primary">
        <h2 className="!mt-0 mb-1 text-amber-600 dark:text-amber-400">
          Not financial advice — you trade at your own risk
        </h2>
        <p className="!text-text-primary">
          TradingKit is a research and education tool for designing and backtesting trading
          strategies in plain English. Backtests and optimisations are <strong>hypothetical</strong>{' '}
          simulations on historical data. Past or simulated performance does not guarantee future
          results. Nothing in the Service is financial, investment, legal, or tax advice, and no
          output is a recommendation to buy or sell anything. <strong>
            You are solely responsible for any trades, orders, or financial decisions you make.
            TradingKit takes no responsibility and accepts no liability for any trades made or for
            any losses, costs, or damages arising from your use of the Service or any strategy,
            signal, or alert it produces.
          </strong>{' '}
          We never place trades for you; any webhook, alert, or integration you configure to act on
          signals is operated entirely at your own risk.
        </p>
      </div>

      <h2>The Service</h2>
      <p>
        TradingKit lets you describe trading ideas in plain English and turns them into strategies
        you can backtest, optimise, and turn into live alerts via connected third-party services.
        Features, limits, and availability may change over time.
      </p>

      <h2>Accounts</h2>
      <p>
        You must provide accurate information and keep your credentials secure. You are responsible
        for activity under your account. You must be of legal age in your jurisdiction to enter
        binding contracts.
      </p>

      <h2>Acceptable use</h2>
      <ul>
        <li>Do not misuse, disrupt, reverse-engineer, or attempt to gain unauthorised access to the Service.</li>
        <li>Do not use the Service for unlawful purposes or to violate any exchange’s or third party’s terms.</li>
        <li>Do not rely on the Service as your sole basis for any financial decision.</li>
      </ul>

      <h2>Subscriptions &amp; billing</h2>
      <p>
        Paid plans are billed on a recurring basis through our payment processor. Credits and plan
        limits are described in-app and may be adjusted. You can manage or cancel your subscription
        from your account; fees already paid are non-refundable except where required by law.
      </p>

      <h2>Third-party services</h2>
      <p>
        The Service relies on third parties (including authentication, payment, AI model providers,
        the Trader.dev backtesting engine, and any exchanges or webhooks you connect). Your use of
        those services is subject to their terms, and we are not responsible for their availability,
        accuracy, or actions.
      </p>

      <h2>Disclaimers &amp; limitation of liability</h2>
      <p>
        The Service is provided “as is” and “as available”, without warranties of any kind. To the
        maximum extent permitted by law, TradingKit and its operators are not liable for any
        indirect, incidental, special, consequential, or trading-related losses, and our total
        liability for any claim is limited to the amount you paid us in the 3 months before the
        claim.
      </p>

      <h2>Changes &amp; termination</h2>
      <p>
        We may update these Terms or the Service at any time. Continued use after changes means you
        accept them. We may suspend or terminate accounts that violate these Terms.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these Terms: <a href="mailto:hi@davidd.tech">hi@davidd.tech</a>.
      </p>
    </LegalShell>
  );
}

export function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy">
      <p>
        This Policy explains what TradingKit collects, how we use it, and your choices. By using the
        Service you agree to this Policy.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Account information</strong> — your email and authentication details, handled by
          our authentication provider.
        </li>
        <li>
          <strong>Usage &amp; content</strong> — the messages you send, strategies you create, and
          backtests/alerts you run, so we can provide and improve the Service.
        </li>
        <li>
          <strong>Billing</strong> — subscription and plan status via our payment processor (we do
          not store full card details).
        </li>
        <li>
          <strong>Technical data</strong> — basic logs and device/usage information for security and
          reliability.
        </li>
      </ul>

      <h2>How we use it</h2>
      <ul>
        <li>To operate, secure, and improve the Service and your account.</li>
        <li>To run your strategies, backtests, optimisations, and alerts.</li>
        <li>To manage subscriptions and credits, and to communicate with you about the Service.</li>
      </ul>

      <h2>Third parties we share with</h2>
      <p>
        We share only what’s needed with service providers that power TradingKit, including
        authentication, payment processing, AI model providers, and the Trader.dev backtesting
        engine. Strategies and signals you choose to send to a webhook, Telegram, email, or exchange
        are delivered to those destinations at your direction. We do not sell your personal data.
      </p>

      <h2>Retention &amp; security</h2>
      <p>
        We keep your data for as long as your account is active or as needed to provide the Service
        and meet legal obligations, and we use reasonable measures to protect it. No method of
        transmission or storage is 100% secure.
      </p>

      <h2>Your choices</h2>
      <p>
        You can access or update your account information in-app, and you can request deletion of
        your account. Depending on your location you may have additional rights over your data.
      </p>

      <h2>Cookies</h2>
      <p>
        We use cookies and similar technologies for sign-in, security, and preferences. Disabling
        them may affect functionality.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about this Policy: <a href="mailto:hi@davidd.tech">hi@davidd.tech</a>.
      </p>
    </LegalShell>
  );
}
