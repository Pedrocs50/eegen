-- Cursos de exemplo (um por idioma) montados com as listas de exemplo, cada um com uma turma de teste.
-- Gerado por supabase/exemplos/montar.py. Rode DEPOIS de listas_de_exemplo.sql (que, se rodado de novo, desfaz as ligações).
-- Em cada curso: uma aula por lista (sem PDF); na turma de teste, as primeiras aulas já liberadas e o resto como exercícios avulsos.
-- Rodar de novo recria cursos e turmas de exemplo (e tira os alunos que entraram nas turmas de teste).

begin;
delete from public.cursos where id in ('9b73f384-6142-5485-8d6f-2f626386cac9', '4e31835b-5cc2-52ae-9e03-47e7be7cd0dc', '42da02ba-3d48-5887-b1a7-c5b37e04b7ce');

-- Inglês · Curso de exemplo
insert into public.cursos (id, titulo, idioma, nivel, descricao) values ('9b73f384-6142-5485-8d6f-2f626386cac9', 'Inglês · Curso de exemplo', 'ingles', 1, 'Curso de demonstração: uma aula por lista de exemplo, do nível 1 ao 6.');
insert into public.turmas (id, nome, curso_id, professor_id) values ('855f0a21-2975-5f92-900a-d658e99e9a32', 'Turma de teste · Inglês', '9b73f384-6142-5485-8d6f-2f626386cac9', (select id from public.perfis where papel = 'admin' order by criado_em limit 1));
insert into public.aulas (id, curso_id, numero, titulo, subtitulo) values ('a18f4cc8-ad15-5b20-8cdc-5ac54896cdc8', '9b73f384-6142-5485-8d6f-2f626386cac9', 1, 'Nice to meet you', 'Primeiros passos para se apresentar com confiança.');
insert into public.aula_listas (aula_id, lista_id, ordem) values ('a18f4cc8-ad15-5b20-8cdc-5ac54896cdc8', '4ba690c0-6dca-5f6e-86cf-9e0644f934eb', 0);
insert into public.aulas_liberadas (turma_id, aula_id) values ('855f0a21-2975-5f92-900a-d658e99e9a32', 'a18f4cc8-ad15-5b20-8cdc-5ac54896cdc8');
insert into public.aulas (id, curso_id, numero, titulo, subtitulo) values ('bc5ccf40-2338-5b0a-825b-227837d7e27d', '9b73f384-6142-5485-8d6f-2f626386cac9', 2, 'At the restaurant', 'Peça, pergunte e pague como um local.');
insert into public.aula_listas (aula_id, lista_id, ordem) values ('bc5ccf40-2338-5b0a-825b-227837d7e27d', 'e81c1da0-791f-52db-81d6-9b4d53214ae8', 0);
insert into public.aulas_liberadas (turma_id, aula_id) values ('855f0a21-2975-5f92-900a-d658e99e9a32', 'bc5ccf40-2338-5b0a-825b-227837d7e27d');
insert into public.aulas (id, curso_id, numero, titulo, subtitulo) values ('522dcdf5-700b-5835-915e-5db15c771818', '9b73f384-6142-5485-8d6f-2f626386cac9', 3, 'Travel plans', 'Planos, decisões e previsões para a sua próxima viagem.');
insert into public.aula_listas (aula_id, lista_id, ordem) values ('522dcdf5-700b-5835-915e-5db15c771818', 'e3545162-dd47-5a62-b054-4d97811fb4d8', 0);
insert into public.aulas_liberadas (turma_id, aula_id) values ('855f0a21-2975-5f92-900a-d658e99e9a32', '522dcdf5-700b-5835-915e-5db15c771818');
insert into public.aulas (id, curso_id, numero, titulo, subtitulo) values ('e98e7eec-d803-588c-8ccb-720a32627dae', '9b73f384-6142-5485-8d6f-2f626386cac9', 4, 'The job interview', 'Fale da sua experiência sem travar na entrevista.');
insert into public.aula_listas (aula_id, lista_id, ordem) values ('e98e7eec-d803-588c-8ccb-720a32627dae', '8ea30ab2-a016-534c-8871-0e2a9c154658', 0);
insert into public.aulas_liberadas (turma_id, aula_id) values ('855f0a21-2975-5f92-900a-d658e99e9a32', 'e98e7eec-d803-588c-8ccb-720a32627dae');
insert into public.aulas (id, curso_id, numero, titulo, subtitulo) values ('cd71241b-e7b8-5e79-a722-40ae358dd3b3', '9b73f384-6142-5485-8d6f-2f626386cac9', 5, 'Renting a flat', 'Entenda as regras antes de assinar o contrato.');
insert into public.aula_listas (aula_id, lista_id, ordem) values ('cd71241b-e7b8-5e79-a722-40ae358dd3b3', 'e1f75ebd-7094-5222-965f-72666f5cb4f7', 0);
insert into public.aulas (id, curso_id, numero, titulo, subtitulo) values ('fc1ac706-dd5f-5fe7-a04b-3c9d4692468e', '9b73f384-6142-5485-8d6f-2f626386cac9', 6, 'Working remotely', 'Hipóteses, arrependimentos e decisões do trabalho remoto.');
insert into public.aula_listas (aula_id, lista_id, ordem) values ('fc1ac706-dd5f-5fe7-a04b-3c9d4692468e', '3afd8890-ee49-52f4-9898-7ca9dee40651', 0);
insert into public.aulas (id, curso_id, numero, titulo, subtitulo) values ('5d980ca0-0498-513d-900e-edb6cdf9b122', '9b73f384-6142-5485-8d6f-2f626386cac9', 7, 'Handling customer complaints', 'Relate o que o cliente disse com precisão e profissionalismo.');
insert into public.aula_listas (aula_id, lista_id, ordem) values ('5d980ca0-0498-513d-900e-edb6cdf9b122', 'fb1bda08-1f91-5a25-9676-4822a2d11bb0', 0);
insert into public.turma_listas (turma_id, lista_id, ordem) values ('855f0a21-2975-5f92-900a-d658e99e9a32', '0d48bd16-6523-5af1-b333-f4905d641745', 0);
insert into public.turma_listas (turma_id, lista_id, ordem) values ('855f0a21-2975-5f92-900a-d658e99e9a32', '7a629608-6250-55d3-b182-95491631c4c8', 1);
insert into public.turma_listas (turma_id, lista_id, ordem) values ('855f0a21-2975-5f92-900a-d658e99e9a32', '4123ed4a-5221-50b6-948f-7e92c0dbde95', 2);

-- Espanhol · Curso de exemplo
insert into public.cursos (id, titulo, idioma, nivel, descricao) values ('4e31835b-5cc2-52ae-9e03-47e7be7cd0dc', 'Espanhol · Curso de exemplo', 'espanhol', 1, 'Curso de demonstração: uma aula por lista de exemplo, do nível 1 ao 6.');
insert into public.turmas (id, nome, curso_id, professor_id) values ('64e00c04-d924-53b9-8237-1d89c39c81f6', 'Turma de teste · Espanhol', '4e31835b-5cc2-52ae-9e03-47e7be7cd0dc', (select id from public.perfis where papel = 'admin' order by criado_em limit 1));
insert into public.aulas (id, curso_id, numero, titulo, subtitulo) values ('94cdfd7c-5996-56a1-bee5-252166ee3a05', '4e31835b-5cc2-52ae-9e03-47e7be7cd0dc', 1, '¡Mucho gusto!', 'O primeiro contato em espanhol, sem medo.');
insert into public.aula_listas (aula_id, lista_id, ordem) values ('94cdfd7c-5996-56a1-bee5-252166ee3a05', '2899780d-6493-53f2-9473-040f3230016b', 0);
insert into public.aulas_liberadas (turma_id, aula_id) values ('64e00c04-d924-53b9-8237-1d89c39c81f6', '94cdfd7c-5996-56a1-bee5-252166ee3a05');
insert into public.aulas (id, curso_id, numero, titulo, subtitulo) values ('7fee9643-e8e5-5faa-a00c-864559147e97', '4e31835b-5cc2-52ae-9e03-47e7be7cd0dc', 2, 'De compras en el mercado', 'Pergunte o preço e escolha o que você gosta.');
insert into public.aula_listas (aula_id, lista_id, ordem) values ('7fee9643-e8e5-5faa-a00c-864559147e97', '78f0fe92-a24a-5813-909f-c510c5623dca', 0);
insert into public.aulas_liberadas (turma_id, aula_id) values ('64e00c04-d924-53b9-8237-1d89c39c81f6', '7fee9643-e8e5-5faa-a00c-864559147e97');
insert into public.aulas (id, curso_id, numero, titulo, subtitulo) values ('287e1af4-ed80-586e-9601-f414372d6b0f', '4e31835b-5cc2-52ae-9e03-47e7be7cd0dc', 3, 'Mi fin de semana', 'Conte o que você fez com o passado mais usado do espanhol.');
insert into public.aula_listas (aula_id, lista_id, ordem) values ('287e1af4-ed80-586e-9601-f414372d6b0f', '36c10283-5fd4-548b-9e3e-262114a169dd', 0);
insert into public.aulas_liberadas (turma_id, aula_id) values ('64e00c04-d924-53b9-8237-1d89c39c81f6', '287e1af4-ed80-586e-9601-f414372d6b0f');
insert into public.aulas (id, curso_id, numero, titulo, subtitulo) values ('214a9d28-aff8-57c6-8cc6-f4aa318447a9', '4e31835b-5cc2-52ae-9e03-47e7be7cd0dc', 4, 'Una entrevista de trabajo', 'Conte sua trajetória profissional como uma boa história.');
insert into public.aula_listas (aula_id, lista_id, ordem) values ('214a9d28-aff8-57c6-8cc6-f4aa318447a9', '93c0c406-3dec-52eb-980b-bc9efe289030', 0);
insert into public.aulas_liberadas (turma_id, aula_id) values ('64e00c04-d924-53b9-8237-1d89c39c81f6', '214a9d28-aff8-57c6-8cc6-f4aa318447a9');
insert into public.aulas (id, curso_id, numero, titulo, subtitulo) values ('28baecef-e5b1-5ab3-9fea-74e56c32fe2e', '4e31835b-5cc2-52ae-9e03-47e7be7cd0dc', 5, 'En la consulta médica', 'Explique o que você sente e entenda as orientações do médico.');
insert into public.aula_listas (aula_id, lista_id, ordem) values ('28baecef-e5b1-5ab3-9fea-74e56c32fe2e', '175d01b8-ac8b-5725-a995-ffc4e2bb5233', 0);
insert into public.aulas (id, curso_id, numero, titulo, subtitulo) values ('ccdb370c-9baa-5a5e-a9f8-a999641ee13e', '4e31835b-5cc2-52ae-9e03-47e7be7cd0dc', 6, 'Viajar por Perú', 'Fale de desejos e planos para a próxima viagem.');
insert into public.aula_listas (aula_id, lista_id, ordem) values ('ccdb370c-9baa-5a5e-a9f8-a999641ee13e', 'cb27c74b-d75d-522f-8be6-7501545c8c06', 0);
insert into public.aulas (id, curso_id, numero, titulo, subtitulo) values ('faac8d45-ed4b-51ee-a029-816e928a1f9c', '4e31835b-5cc2-52ae-9e03-47e7be7cd0dc', 7, 'La reunión de equipo', 'Concorde, discorde e argumente numa reunião.');
insert into public.aula_listas (aula_id, lista_id, ordem) values ('faac8d45-ed4b-51ee-a029-816e928a1f9c', '152cd4c7-c85c-50ce-a8de-c2118950d522', 0);
insert into public.turma_listas (turma_id, lista_id, ordem) values ('64e00c04-d924-53b9-8237-1d89c39c81f6', 'e79d982b-f800-5797-b154-d7f6ee628aa9', 0);
insert into public.turma_listas (turma_id, lista_id, ordem) values ('64e00c04-d924-53b9-8237-1d89c39c81f6', '5ebb0d70-5ae9-524a-9ce0-40d6ccb70e64', 1);
insert into public.turma_listas (turma_id, lista_id, ordem) values ('64e00c04-d924-53b9-8237-1d89c39c81f6', '6c43a7df-15e1-5a19-a9b2-c2aa047e6db5', 2);

-- Francês · Curso de exemplo
insert into public.cursos (id, titulo, idioma, nivel, descricao) values ('42da02ba-3d48-5887-b1a7-c5b37e04b7ce', 'Francês · Curso de exemplo', 'frances', 1, 'Curso de demonstração: uma aula por lista de exemplo, do nível 1 ao 6.');
insert into public.turmas (id, nome, curso_id, professor_id) values ('66c8c5c9-3fb7-5c37-b9f5-f9cae15580c0', 'Turma de teste · Francês', '42da02ba-3d48-5887-b1a7-c5b37e04b7ce', (select id from public.perfis where papel = 'admin' order by criado_em limit 1));
insert into public.aulas (id, curso_id, numero, titulo, subtitulo) values ('78bb53b7-8004-5082-9b43-4a6aa7f0e99c', '42da02ba-3d48-5887-b1a7-c5b37e04b7ce', 1, 'Enchanté !', 'Seus primeiros minutos falando francês.');
insert into public.aula_listas (aula_id, lista_id, ordem) values ('78bb53b7-8004-5082-9b43-4a6aa7f0e99c', '65858bd9-044f-52d7-9a11-732b2981f717', 0);
insert into public.aulas_liberadas (turma_id, aula_id) values ('66c8c5c9-3fb7-5c37-b9f5-f9cae15580c0', '78bb53b7-8004-5082-9b43-4a6aa7f0e99c');
insert into public.aulas (id, curso_id, numero, titulo, subtitulo) values ('881fd8d4-5131-546e-a36d-9cba82420c37', '42da02ba-3d48-5887-b1a7-c5b37e04b7ce', 2, 'Un week-end à Bordeaux', 'Conte sua viagem no passado sem errar o auxiliar.');
insert into public.aula_listas (aula_id, lista_id, ordem) values ('881fd8d4-5131-546e-a36d-9cba82420c37', 'd589592f-1774-5558-a88b-87f2ee810560', 0);
insert into public.aulas_liberadas (turma_id, aula_id) values ('66c8c5c9-3fb7-5c37-b9f5-f9cae15580c0', '881fd8d4-5131-546e-a36d-9cba82420c37');
insert into public.aulas (id, curso_id, numero, titulo, subtitulo) values ('07eba57e-d068-50ee-b325-141374da639d', '42da02ba-3d48-5887-b1a7-c5b37e04b7ce', 3, 'Préparer la réunion', 'Evite repetições e soe natural no trabalho.');
insert into public.aula_listas (aula_id, lista_id, ordem) values ('07eba57e-d068-50ee-b325-141374da639d', 'bb1bcb93-319e-5ba6-b10a-e71c091ad8b3', 0);
insert into public.turma_listas (turma_id, lista_id, ordem) values ('66c8c5c9-3fb7-5c37-b9f5-f9cae15580c0', 'af360a0b-2787-5eb4-9ffe-b50411da880e', 0);
insert into public.turma_listas (turma_id, lista_id, ordem) values ('66c8c5c9-3fb7-5c37-b9f5-f9cae15580c0', '83973e49-4f33-5a82-ae09-3a97d9597370', 1);

commit;
