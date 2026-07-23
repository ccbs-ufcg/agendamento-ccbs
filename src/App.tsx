{/* MODAL DA CENTRAL DE AJUDA COMPLETO */}
      {showHelpModal && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[140] flex items-center justify-center p-4 print:hidden">
          <div className="bg-white rounded-[2rem] p-6 md:p-8 max-w-2xl w-full shadow-2xl text-left relative flex flex-col max-h-[90vh]">
            
            {/* BOTÃO DE FECHAR */}
            <button 
              onClick={() => setShowHelpModal(false)}
              className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 rounded-full transition-all cursor-pointer"
              title="Fechar Central de Ajuda"
            >
              <X className="w-6 h-6" />
            </button>

            {/* CABEÇALHO DO MODAL */}
            <div className="flex items-center gap-3 mb-4 pb-4 border-b border-slate-100 flex-shrink-0">
              <div className="bg-blue-100 p-3 rounded-2xl text-blue-700">
                <HelpCircle className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-xl font-black uppercase text-slate-800">Central de Ajuda</h3>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Guia Passo a Passo de Agendamento • CCBS/UFCG</p>
              </div>
            </div>

            {/* CONTEÚDO COM ROLAGEM */}
            <div className="space-y-6 text-xs text-slate-600 leading-relaxed overflow-y-auto pr-2 flex-1 scrollbar-thin">
              
              {/* INTRODUÇÃO */}
              <div className="bg-blue-50/60 p-4 rounded-2xl border border-blue-100">
                <p className="font-bold text-blue-900 text-sm mb-1">📅 Como Agendar um Espaço no CCBS/UFCG</p>
                <p className="text-slate-700">
                  Bem-vindo(a) ao nosso sistema de agendamentos! Este guia vai te ensinar, de forma muito simples, como reservar o <strong>Auditório</strong>, a <strong>Sala de Reunião</strong> ou a <strong>Sala 01</strong>, além de como baixar o seu documento de confirmação.
                </p>
              </div>

              {/* TIPO DE USUÁRIOS */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <span className="font-black text-slate-800 block text-[11px] uppercase mb-1">1. Usuários Externos</span>
                  <p className="text-slate-500 text-[11px]">Demais Centros da UFCG e instituições externas.</p>
                  <p className="mt-2 text-slate-700 font-medium">
                    <strong>Solicitação:</strong> Baixe o Anexo II (Ofício de Solicitação) no portal do CCBS, preencha-o e envie para: <a href="mailto:secretaria.ccbs@ufcg.edu.br" className="text-blue-600 underline font-bold">secretaria.ccbs@ufcg.edu.br</a>.
                  </p>
                </div>

                <div className="bg-blue-50/40 p-4 rounded-2xl border border-blue-100">
                  <span className="font-black text-blue-900 block text-[11px] uppercase mb-1">2. Usuários Internos (CCBS/UFCG)</span>
                  <p className="text-slate-500 text-[11px]">Docentes, técnicos administrativos e estudantes vinculados ao Centro.</p>
                  <p className="mt-2 text-slate-700 font-medium">
                    Faça o agendamento diretamente por esta plataforma seguindo o passo a passo abaixo.
                  </p>
                </div>
              </div>

              {/* PASSO A PASSO DETALHADO */}
              <div className="space-y-3">
                <h4 className="font-black text-slate-800 uppercase text-xs tracking-wider border-b pb-1">Passo a Passo do Agendamento On-line</h4>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-1">
                  <p className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                    <span>🕒</span> Passo 1: Olhar o Calendário (Ver se o dia está livre)
                  </p>
                  <p>
                    Antes de preencher qualquer papel, olhe para o lado direito da tela onde fica o Calendário. Use as setinhas azuladas (&lt; e &gt;) perto do nome do mês para mudar de mês se precisar. Dias que já possuem compromissos mostram uma barrinha colorida com o horário. Clique em cima do dia desejado para ver os detalhes. Se o seu horário estiver livre, siga para o Passo 2!
                  </p>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-1">
                  <p className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                    <span>✍️</span> Passo 2: Preencher o Formulário (Lado Esquerdo da Tela)
                  </p>
                  <p>No painel "Novo Agendamento", preencha os campos na ordem:</p>
                  <ul className="list-disc pl-4 space-y-1 mt-1 text-slate-600">
                    <li><strong>Local & Data:</strong> Escolha o espaço e a data do evento.</li>
                    <li><strong>Início e Fim:</strong> Escolha o horário de início e término.</li>
                    <li><strong>Evento:</strong> Digite o nome ou assunto do evento (Ex: Defesa de TCC, Palestra).</li>
                    <li><strong>Responsável:</strong> Digite seu nome completo.</li>
                    <li><strong>Documentos e Contato:</strong> Preencha CPF, Telefone com DDD e E-mail.</li>
                    <li><strong>Setor / Departamento:</strong> Digite a qual setor da UFCG você pertence (Ex: DC-CCBS).</li>
                  </ul>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-1">
                  <p className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                    <span>🔒</span> Passo 3: Criar uma Senha de Segurança
                  </p>
                  <p>
                    No final do formulário, digite uma senha simples de sua escolha no campo "Senha p/ Cancelamento". Guarde essa senha! Ela será exigida se você precisar cancelar o agendamento ou emitir a 2ª via do documento.
                  </p>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-1">
                  <p className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                    <span>🚀</span> Passo 4: Confirmar o Agendamento
                  </p>
                  <p>
                    Clique no botão azul "Confirmar Agendamento". Se der tudo certo, uma mensagem de sucesso aparecerá e o Termo de Responsabilidade se abrirá na tela.
                  </p>
                </div>

                <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200 text-amber-900 space-y-2">
                  <p className="font-black text-xs uppercase flex items-center gap-1.5 text-amber-900">
                    <span>📄</span> Passo 5: Baixar o Termo em PDF e Enviar (Obrigatório)
                  </p>
                  <p>
                    Clique no botão <strong>"Baixar Termo PDF"</strong> e depois em "Fechar".
                  </p>
                  <div className="bg-white/80 p-3 rounded-xl border border-amber-200 text-xs space-y-1">
                    <p className="font-bold text-slate-800">O que fazer com o arquivo baixado?</p>
                    <ol className="list-decimal pl-4 space-y-1 text-slate-700">
                      <li>Acesse o site do GOV.BR: <a href="https://assinador.iti.br" target="_blank" rel="noopener noreferrer" className="text-blue-600 font-bold underline">assinador.iti.br</a>.</li>
                      <li>Entre com sua conta do governo e assine o PDF digitalmente.</li>
                      <li>
                        Conforme a <strong>Resolução CONSAD/CCBS n° 01/2026</strong>, envie o termo assinado para: <a href="mailto:reservaccbs@gmail.com" className="font-bold text-blue-700 underline">reservaccbs@gmail.com</a> em até <strong>48 horas</strong>, sob pena de cancelamento da reserva.
                      </li>
                    </ol>
                  </div>
                </div>
              </div>

              {/* DICAS ÚTEIS */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2">
                <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                  <span>💡</span> Dicas Úteis
                </h4>
                <ul className="list-disc pl-4 space-y-1 text-slate-600">
                  <li><strong>Segunda Via do Documento:</strong> Esqueceu de baixar? No topo da página, clique em "2ª Via do Termo", digite seu protocolo e a senha criada no Passo 3.</li>
                  <li><strong>Finais de Semana:</strong> O sistema aceita agendamentos apenas em dias úteis (Segunda a Sexta).</li>
                </ul>
              </div>

              {/* CONTATOS */}
              <div className="bg-slate-900 text-white p-4 rounded-2xl space-y-2">
                <h4 className="font-black uppercase text-[11px] text-blue-400 tracking-wider">📞 Contatos Oficiais</h4>
                <div className="space-y-1 text-[11px]">
                  <p><strong>Envio do Termo de Responsabilidade:</strong> <a href="mailto:reservaccbs@gmail.com" className="text-blue-300 underline font-mono">reservaccbs@gmail.com</a></p>
                  <p><strong>Dúvidas e Sugestões:</strong> <a href="mailto:renato.freitas@tecnico.ufcg.edu.br" className="text-blue-300 underline font-mono">renato.freitas@tecnico.ufcg.edu.br</a></p>
                </div>
              </div>

            </div>

            {/* RODAPÉ DO MODAL */}
            <div className="pt-4 mt-2 border-t border-slate-100 flex-shrink-0">
              <button 
                onClick={() => setShowHelpModal(false)} 
                className="w-full py-4 bg-blue-600 text-white font-black rounded-xl uppercase tracking-widest text-[10px] hover:bg-blue-700 transition-all text-center cursor-pointer shadow-lg shadow-blue-500/20"
              >
                Entendido
              </button>
            </div>

          </div>
        </div>
      )}
