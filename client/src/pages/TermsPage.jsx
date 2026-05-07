import { Link } from 'react-router-dom'

export default function TermsPage() {
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
        <h1 className="text-3xl font-extrabold text-navy-900 mb-2">Termos de Uso</h1>
        <p className="text-sm text-gray-500 mb-10">Última atualização: maio de 2025</p>

        <div className="space-y-8 text-gray-700 text-sm leading-relaxed">

          <section>
            <h2 className="text-lg font-bold text-navy-900 mb-3">1. Aceitação dos Termos</h2>
            <p>
              Ao criar uma conta ou utilizar o AgendarAdv, você concorda integralmente com estes Termos de Uso.
              Caso não concorde com qualquer disposição, não utilize a plataforma.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-navy-900 mb-3">2. O Serviço</h2>
            <p>
              O AgendarAdv é uma plataforma de gestão de agenda, clientes e cobranças desenvolvida exclusivamente
              para advogados brasileiros. A plataforma oferece:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-gray-600">
              <li>Agenda e controle de compromissos</li>
              <li>Cadastro e histórico de clientes</li>
              <li>Link público de agendamento personalizado</li>
              <li>Dashboard de gestão e indicadores</li>
              <li>Integração com a fintech Asaas para geração de cobranças</li>
              <li>Envio de alertas por e-mail e WhatsApp</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-navy-900 mb-3">3. Cadastro e Responsabilidades do Usuário</h2>
            <p>
              Para utilizar o AgendarAdv é necessário criar uma conta com informações verdadeiras e atualizadas.
              Você é inteiramente responsável pela guarda de suas credenciais de acesso e por todas as atividades
              realizadas em sua conta.
            </p>
            <p className="mt-2">
              Você se compromete a:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-gray-600">
              <li>Não compartilhar sua senha com terceiros</li>
              <li>Utilizar a plataforma em conformidade com a legislação brasileira vigente</li>
              <li>Não inserir dados falsos de clientes ou cobranças</li>
              <li>Respeitar o sigilo profissional previsto no Estatuto da OAB</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-navy-900 mb-3">4. Planos e Cobrança</h2>
            <p className="mb-3">
              O AgendarAdv oferece dois planos:
            </p>
            <p className="mb-2"><strong>Plano Gratuito (R$ 0/mês):</strong> acesso às funcionalidades essenciais da plataforma, com os seguintes limites:
            </p>
            <ul className="list-disc list-inside text-gray-600 space-y-1 mb-4">
              <li>Limite de 30 consultas/agendamentos por mês</li>
              <li>Possibilidade de exibição de anúncios na interface</li>
              <li>Sem integração com Google Agenda, Outlook, Meet ou Teams</li>
              <li>Sem transcrição de reuniões por IA</li>
              <li>Sem confirmação prévia de presença via WhatsApp</li>
            </ul>
            <p className="mb-2"><strong>Plano Pro (R$ 29,90/mês):</strong> todas as funcionalidades sem limitações, incluindo agenda ilimitada, sem anúncios, integrações avançadas, transcrição por IA e confirmações automáticas de presença.</p>
            <p className="mt-3">
              O AgendarAdv <strong>não processa pagamentos</strong> de clientes finais diretamente. A integração
              financeira é realizada via Asaas, empresa regulamentada pelo Banco Central do Brasil (Bacen). O valor
              das consultas é transferido diretamente para a conta bancária do advogado cadastrada no Asaas.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-navy-900 mb-3">5. Propriedade Intelectual</h2>
            <p>
              Todo o código-fonte, design, marca, logotipos e conteúdos do AgendarAdv são de propriedade exclusiva
              de seus desenvolvedores. É vedada a cópia, reprodução ou engenharia reversa da plataforma sem
              autorização expressa por escrito.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-navy-900 mb-3">6. Dados dos Clientes do Advogado</h2>
            <p>
              Os dados dos clientes inseridos no AgendarAdv (nome, e-mail, telefone, descrição de casos) são de
              responsabilidade exclusiva do advogado usuário. O AgendarAdv trata esses dados como operador, conforme
              a Lei Geral de Proteção de Dados (Lei 13.709/2018 — LGPD), cabendo ao advogado o papel de controlador.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-navy-900 mb-3">7. Limitação de Responsabilidade</h2>
            <p>
              O AgendarAdv não se responsabiliza por:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-gray-600">
              <li>Falhas nos serviços de terceiros (Asaas, Supabase, Resend, provedores de e-mail)</li>
              <li>Perda de dados decorrente de mau uso do sistema pelo usuário</li>
              <li>Consequências jurídicas do conteúdo inserido pelo advogado</li>
              <li>Interrupções temporárias do serviço por manutenção ou caso fortuito</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-navy-900 mb-3">8. Cancelamento e Exclusão de Conta</h2>
            <p>
              O usuário pode cancelar sua conta a qualquer momento através das configurações da plataforma. Após o
              cancelamento, os dados são mantidos por 30 dias e depois excluídos definitivamente. O AgendarAdv
              reserva-se o direito de suspender contas que violem estes Termos.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-navy-900 mb-3">9. Alterações nos Termos</h2>
            <p>
              Estes Termos podem ser atualizados a qualquer momento. Mudanças relevantes serão comunicadas por
              e-mail com antecedência mínima de 15 dias. O uso continuado da plataforma após esse prazo implica
              aceitação dos novos termos.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-navy-900 mb-3">10. Foro e Legislação Aplicável</h2>
            <p>
              Estes Termos são regidos pela legislação brasileira. Fica eleito o foro da Comarca de São Paulo/SP
              para dirimir eventuais conflitos, renunciando as partes a qualquer outro.
            </p>
          </section>

        </div>
      </main>

      <footer className="border-t border-gray-200 py-6 px-6 text-center text-gray-400 text-xs">
        © {new Date().getFullYear()} AgendarAdv ·{' '}
        <Link to="/privacidade" className="hover:text-navy-700 transition-colors">Política de Privacidade</Link>
      </footer>
    </div>
  )
}
