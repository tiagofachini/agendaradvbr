import { Link } from 'react-router-dom'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-navy-900 px-6 h-16 flex items-center">
        <Link to="/" className="flex items-center gap-2">
          <img src="/logo.png" alt="AgendarAdv" className="h-8 w-8 object-contain" />
          <span className="text-white font-bold text-lg">
            Agendar<span className="text-brand-500">Adv</span>
          </span>
        </Link>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-14">
        <h1 className="text-3xl font-extrabold text-navy-900 mb-2">Política de Privacidade</h1>
        <p className="text-sm text-gray-500 mb-10">Última atualização: maio de 2025</p>

        <div className="space-y-8 text-gray-700 text-sm leading-relaxed">

          <section>
            <h2 className="text-lg font-bold text-navy-900 mb-3">1. Quem somos</h2>
            <p>
              O AgendarAdv é uma plataforma de gestão para advogados brasileiros. Esta política descreve como
              coletamos, usamos, armazenamos e protegemos seus dados pessoais em conformidade com a Lei Geral de
              Proteção de Dados (LGPD — Lei 13.709/2018).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-navy-900 mb-3">2. Dados que Coletamos</h2>
            <p className="mb-2"><strong>Dados do advogado (usuário da plataforma):</strong></p>
            <ul className="list-disc list-inside space-y-1 text-gray-600 mb-4">
              <li>Nome completo, e-mail e número de WhatsApp (fornecidos no cadastro)</li>
              <li>Foto de perfil e logotipo do escritório (enviados voluntariamente)</li>
              <li>Dados de endereço do escritório (opcionais)</li>
              <li>Chave de API do Asaas (armazenada de forma criptografada)</li>
              <li>Dados de navegação e uso da plataforma (logs técnicos)</li>
            </ul>
            <p className="mb-2"><strong>Dados inseridos pelo advogado (sobre seus clientes):</strong></p>
            <ul className="list-disc list-inside space-y-1 text-gray-600">
              <li>Nome, e-mail e telefone dos clientes finais</li>
              <li>Descrições de consultas e demandas jurídicas</li>
              <li>Histórico de agendamentos e pagamentos</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-navy-900 mb-3">3. Como Usamos os Dados</h2>
            <ul className="list-disc list-inside space-y-1 text-gray-600">
              <li>Prestação do serviço de agendamento, gestão e cobranças</li>
              <li>Envio de notificações transacionais (confirmações, alertas de agendamento)</li>
              <li>Autenticação segura e controle de acesso</li>
              <li>Melhoria contínua da plataforma com base em dados agregados e anonimizados</li>
              <li>Comunicação sobre atualizações relevantes do serviço</li>
            </ul>
            <p className="mt-3">
              <strong>Não vendemos nem compartilhamos seus dados pessoais com terceiros para fins de marketing.</strong>
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-navy-900 mb-3">4. Compartilhamento com Terceiros</h2>
            <p>Utilizamos os seguintes serviços de terceiros para operar a plataforma:</p>
            <div className="mt-3 space-y-2">
              {[
                ['Supabase', 'Banco de dados, autenticação e armazenamento de arquivos (servidores na região de São Paulo)'],
                ['Asaas', 'Processamento de cobranças e pagamentos (fintech regulamentada pelo Bacen)'],
                ['Resend', 'Envio de e-mails transacionais'],
              ].map(([name, desc]) => (
                <div key={name} className="flex gap-3 bg-gray-100 rounded-lg p-3">
                  <span className="font-semibold text-navy-900 w-20 flex-shrink-0">{name}</span>
                  <span className="text-gray-600">{desc}</span>
                </div>
              ))}
            </div>
            <p className="mt-3">
              Cada um desses serviços possui sua própria política de privacidade e está sujeito à legislação
              aplicável ao seu país de operação.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-navy-900 mb-3">5. Armazenamento e Segurança</h2>
            <p>
              Os dados são armazenados em servidores na região de São Paulo (Brasil) via Supabase.
              Adotamos as seguintes medidas de segurança:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-gray-600">
              <li>Criptografia em trânsito (HTTPS/TLS) e em repouso</li>
              <li>Row Level Security (RLS) no banco de dados — cada advogado acessa somente seus dados</li>
              <li>Autenticação por JWT com expiração automática</li>
              <li>Chaves de API sensíveis armazenadas de forma criptografada</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-navy-900 mb-3">6. Retenção de Dados</h2>
            <p>
              Os dados são mantidos enquanto a conta estiver ativa. Após o cancelamento da conta, os dados são
              retidos por 30 dias para possibilitar eventual recuperação e, decorrido esse prazo, são excluídos
              permanentemente dos sistemas do AgendarAdv.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-navy-900 mb-3">7. Seus Direitos (LGPD)</h2>
            <p>Como titular de dados, você tem direito a:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-gray-600">
              <li>Confirmar a existência e acessar seus dados</li>
              <li>Corrigir dados incompletos, inexatos ou desatualizados</li>
              <li>Solicitar a anonimização, bloqueio ou eliminação dos dados</li>
              <li>Portabilidade dos dados a outro fornecedor de serviço</li>
              <li>Revogar consentimento a qualquer momento</li>
            </ul>
            <p className="mt-3">
              Para exercer esses direitos, entre em contato pelo e-mail:{' '}
              <a href="mailto:privacidade@agendar.adv.br" className="text-navy-700 hover:underline">
                privacidade@agendar.adv.br
              </a>
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-navy-900 mb-3">8. Cookies</h2>
            <p>
              O AgendarAdv utiliza cookies e armazenamento local exclusivamente para fins técnicos: manter a sessão
              autenticada e armazenar preferências de interface. Não utilizamos cookies de rastreamento ou publicidade.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-navy-900 mb-3">9. Alterações nesta Política</h2>
            <p>
              Esta Política pode ser atualizada periodicamente. Mudanças relevantes serão comunicadas por e-mail
              com antecedência mínima de 15 dias. A versão vigente estará sempre disponível em{' '}
              <Link to="/privacidade" className="text-navy-700 hover:underline">agendar.adv.br/privacidade</Link>.
            </p>
          </section>

        </div>
      </main>

      <footer className="border-t border-gray-200 py-6 px-6 text-center text-gray-400 text-xs">
        © {new Date().getFullYear()} AgendarAdv ·{' '}
        <Link to="/termos" className="hover:text-navy-700 transition-colors">Termos de Uso</Link>
      </footer>
    </div>
  )
}
