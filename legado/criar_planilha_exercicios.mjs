import fs from "node:fs/promises";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputDir = "C:/Repositorios/audio para exericio/outputs/roteiros_exercicios";
const headers = ["Tipo", "Conteúdo", "Alt A", "Alt B", "Alt C", "Alt D", "Alt E", "Gabarito", "Explicação", "Link do Formulário:", "Link"];

const episodes = [
  { code:"A0_01", level:"Below Beginner (Pre-A1)", title:"Greetings at the Cafe", file:"A0_01_Greetings_at_the_Cafe.txt", tf:[["Sam orders a small coffee.","True"],["Sam does not want milk.","False"],["Mia gives Sam his drink.","True"]], mc:[["What does Sam order?","Coffee","Tea","Juice","A"],["What size does Sam choose?","Small","Big","Medium","A"],["Who says ‘Thank you’?","Sam","Mia","Nobody","A"]]},
  { code:"A0_02", level:"Below Beginner (Pre-A1)", title:"My New Class", file:"A0_02_My_New_Class.txt", tf:[["Lucas is new in the class.","True"],["The book is red.","False"],["Ms Green is the teacher.","True"]], mc:[["What is the teacher’s name?","Ms Green","Ms Brown","Ms Lucas","A"],["What colour is the book?","Blue","Red","Green","A"],["Who receives a book?","Lucas","Ms Green","A parent","A"]]},
  { code:"A1_01", level:"Beginner (A1)", title:"At the Supermarket", file:"A1_01_At_the_Supermarket.txt", tf:[["They need two bottles of milk.","True"],["The eggs are next to the bread.","False"],["They decide to buy six apples.","True"]], mc:[["What do Nora and Ben need first?","Bread and eggs","Fish and rice","Coffee and tea","A"],["Where are the eggs?","Next to the cheese","Near the milk","By the apples","A"],["How many apples do they get?","Six","Two","Ten","A"]]},
  { code:"A1_02", level:"Beginner (A1)", title:"Bus to the Park", file:"A1_02_Bus_to_the_Park.txt", tf:[["Ella wants to go to the city park.","True"],["She needs bus number twenty.","False"],["The ticket costs two pounds.","True"]], mc:[["Which bus should Ella take?","Number twelve","Number ten","Number two","A"],["Where does the bus stop?","In front of the park","At the station","Behind the school","A"],["When does the bus leave?","At ten","At twelve","At two","A"]]},
  { code:"A1_03", level:"Beginner (A1)", title:"After Work", file:"A1_03_After_Work.txt", tf:[["Ana is free after work.","True"],["Ana loves playing tennis.","False"],["They meet at seven.","True"]], mc:[["What does James first suggest?","Playing tennis","Going shopping","Watching a film","A"],["What food does Ana like?","Pizza","Salad","Soup","A"],["Where will they meet?","Pizza House","The tennis club","Ana’s office","A"]]},
  { code:"A2_01", level:"Elementary (A2)", title:"Doctor Appointment", file:"A2_01_Doctor_Appointment.txt", tf:[["David has had a sore throat for three days.","True"],["David chooses an appointment at eleven tomorrow.","False"],["He needs to bring his health card.","True"]], mc:[["Who does David want to see?","Dr Patel","Dr Green","A dentist","A"],["What time is David’s appointment?","Four thirty","Eleven","Six","A"],["Why does David change the first appointment?","He wants to come after work","It is too urgent","He is travelling","A"]]},
  { code:"A2_02", level:"Elementary (A2)", title:"Renting a Bike", file:"A2_02_Renting_a_Bike.txt", tf:[["Kim rents a bike for one day.","True"],["The blue route is difficult.","False"],["The helmet is included in the price.","True"]], mc:[["What extra item does Kim request?","A helmet","A tent","A lock only","A"],["How much is the rental?","Fifteen euros","Five euros","Twenty-five euros","A"],["When must Kim return the bike?","Before six o’clock","Before noon","The next morning","A"]]},
  { code:"A2_03", level:"Elementary (A2)", title:"A Lost Jacket", file:"A2_03_A_Lost_Jacket.txt", tf:[["Maya lost her jacket yesterday.","True"],["The jacket is blue.","False"],["Her train card was inside the jacket.","True"]], mc:[["What colour is Maya’s jacket?","Black","Blue","Red","A"],["What is near the pocket?","A red button","A name tag","A zip","A"],["What must Maya write down?","Her name and phone number","Her address and age","Her email password","A"]]},
  { code:"B1_01", level:"Pre-Intermediate (B1)", title:"Weekend Trip Plans", file:"B1_01_Weekend_Trip_Plans.txt", tf:[["Priya first considered visiting Brighton.","True"],["They choose Oxford because the forecast is sunny.","False"],["Leo will look for a reasonably priced hotel.","True"]], mc:[["Why do they choose Oxford?","There are museums if it rains","It is nearer than Brighton","Priya has family there","A"],["What time does the train leave?","Eight twenty","Eight o’clock","Seven twenty","A"],["What is Priya saving for?","Her summer holiday","A new hotel","A car","A"]]},
  { code:"B1_02", level:"Pre-Intermediate (B1)", title:"The Group Project", file:"B1_02_The_Group_Project.txt", tf:[["Sara has completed the slides.","False"],["Ben had an internet problem.","True"],["They plan to practise on Thursday.","True"]], mc:[["What has Sara researched?","The causes of air pollution","The history of science","School rules","A"],["What information is missing?","The survey results","The slides","The project title","A"],["When does Tom want the results?","Tomorrow morning","Friday afternoon","Next week","A"]]},
  { code:"B1_03", level:"Pre-Intermediate (B1)", title:"Changing a Hotel Booking", file:"B1_03_Changing_a_Hotel_Booking.txt", tf:[["Oliver’s flight was cancelled.","True"],["He will arrive before six in the evening.","False"],["The hotel charges him to change the date.","False"]], mc:[["Which day does Oliver move his booking to?","Saturday","Thursday","Sunday","A"],["Until when will the room be available?","Midnight","Ten o’clock","Six o’clock","A"],["How will Oliver receive the confirmation?","By email","By post","By text message","A"]]},
  { code:"B2_01", level:"Intermediate (B2)", title:"Office Renovation Meeting", file:"B2_01_Office_Renovation_Meeting.txt", tf:[["The builders will start on the third floor.","True"],["The temporary arrangement lasts about three months.","False"],["The landlord offers offices at no extra cost.","True"]], mc:[["Why can’t customer service stay in a noisy room?","They need to speak with clients","They work only at night","They dislike the third floor","A"],["Where can customer-service staff work temporarily?","In the next building","At home only","In the car park","A"],["What will Helen draft?","An email for clients","A new contract","A building plan","A"]]},
  { code:"B2_02", level:"Intermediate (B2)", title:"Community Garden Proposal", file:"B2_02_Community_Garden_Proposal.txt", tf:[["The garden would offer workshops.","True"],["The businesses will pay all costs forever.","False"],["The plan includes wheelchair access.","True"]], mc:[["Who may donate tools and seeds?","Three local businesses","The library staff","A national charity","A"],["How could the garden earn some income?","By selling produce to a cafe","By charging children","By renting the library","A"],["What would the committee do next?","Consider the proposal next week","Build the garden tomorrow","Close the library","A"]]},
  { code:"C1_01", level:"Advanced (C1)", title:"Podcast on Remote Work", file:"C1_01_Podcast_on_Remote_Work.txt", tf:[["Dr Lee thinks remote work should always be compulsory.","False"],["Clear objectives are more important than location alone.","True"],["Dr Lee recommends treating the first policy as permanent.","False"]], mc:[["What can newer staff lose in fully remote teams?","Informal contact","Their salaries","Their equipment","A"],["What mistake do organisations make?","Copying another company’s policy","Collecting feedback","Setting clear objectives","A"],["What should a company do first?","Run a short trial","Close its office","Buy more computers","A"]]},
  { code:"C1_02", level:"Advanced (C1)", title:"The Train Service Debate", file:"C1_02_The_Train_Service_Debate.txt", tf:[["The estimate includes reduced road congestion.","False"],["The councillor would revise the timetable before cancelling the plan.","True"],["He evaluates public transport only by fare revenue.","False"]], mc:[["Which group may benefit from the night train?","Late-shift workers","Only tourists","Schoolchildren at noon","A"],["Why might a service appear unpopular?","Its times may be inconvenient","Tickets are free","Roads are empty","A"],["What should be included in assessment?","Wider social effect","Only ticket sales","Only staff salaries","A"]]},
  { code:"C1_03", level:"Advanced (C1)", title:"Negotiating a Publishing Contract", file:"C1_03_Negotiating_a_Publishing_Contract.txt", tf:[["The editor wants a very large first print run.","False"],["The contract will allow credited extracts for teaching.","True"],["The editor prefers a rushed July manuscript.","False"]], mc:[["Why does the editor propose a modest print run?","The subject has a specialised market","The author requested it","Paper is unavailable","A"],["What would happen if demand increases?","The book could be reprinted quickly","The digital edition would end","The contract would be cancelled","A"],["Why is the author concerned about the deadline?","Sources still need checking","The book is already late","The editor is unavailable","A"]]},
];

function answerText(letter, options) { return options[letter.charCodeAt(0) - 65]; }
function makeTrueFalseSheet(wb, ep, number) {
  const sheet = wb.worksheets.add(`${String(number).padStart(2, "0")}_${ep.code}_TF`);
  const rows = [headers, ["texto", `Listening: ${ep.title}`, `Level: ${ep.level}. Audio file: roteiros/${ep.file}\nListen to the audio, then choose True or False.`, "", "", "", "", "", "" ]];
  ep.tf.forEach(([statement, answer], i) => rows.push(["pergunta", `${i + 1}. ${statement}`, "True", "False", "", "", "", answer === "True" ? "A" : "B", `The audio states that this is ${answer.toLowerCase()}.`]));
  sheet.getRange(`A1:K${rows.length}`).values = rows;
  styleSheet(sheet, `${ep.title} — True or False`);
}
function makeChoiceSheet(wb, ep, number) {
  const sheet = wb.worksheets.add(`${String(number).padStart(2, "0")}_${ep.code}_MC`);
  const rows = [headers, ["texto", `Listening: ${ep.title}`, `Level: ${ep.level}. Audio file: roteiros/${ep.file}\nListen to the audio, then choose the best answer.`, "", "", "", "", "", "" ]];
  ep.mc.forEach(([question, a, b, c, correct], i) => rows.push(["pergunta", `${i + 1}. ${question}`, a, b, c, "", "", correct, `Correct answer: ${answerText(correct, [a,b,c])}.`]));
  sheet.getRange(`A1:K${rows.length}`).values = rows;
  styleSheet(sheet, `${ep.title} — Multiple Choice`);
}
function styleSheet(sheet, title) {
  sheet.showGridLines = false;
  sheet.freezePanes.freezeRows(1);
  sheet.getRange("A1:K1").format = { fill: "#1F4E78", font: { name: "Arial", bold: true, color: "#FFFFFF" }, horizontalAlignment: "center", verticalAlignment: "center", wrapText: true };
  sheet.getRange("A2:I2").format = { fill: "#EAF2F8", font: { name: "Arial", italic: true, color: "#1F1F1F" }, wrapText: true, verticalAlignment: "top" };
  sheet.getRange("A3:I10").format = { font: { name: "Arial", size: 10, color: "#1F1F1F" }, wrapText: true, verticalAlignment: "top" };
  sheet.getRange("A1").format.columnWidth = 15;
  sheet.getRange("B1").format.columnWidth = 48;
  sheet.getRange("C1:G1").format.columnWidth = 20;
  sheet.getRange("H1").format.columnWidth = 13;
  sheet.getRange("I1").format.columnWidth = 36;
  sheet.getRange("J1:K1").format.columnWidth = 20;
  sheet.getRange("2:2").format.rowHeight = 55;
  sheet.tabColor = "#5B9BD5";
}

const wb = Workbook.create();
const index = wb.worksheets.add("Roteiros");
index.getRange("A1:D16").values = [["Código", "Nível", "Título", "Arquivo de áudio"], ...episodes.map(e => [e.code, e.level, e.title, `roteiros/${e.file}`])];
index.showGridLines = false;
index.freezePanes.freezeRows(1);
index.getRange("A1:D1").format = { fill: "#1F4E78", font: { name: "Arial", bold: true, color: "#FFFFFF" }, horizontalAlignment: "center" };
index.getRange("A2:D16").format = { font: { name: "Arial", size: 10 }, wrapText: true };
index.getRange("A1").format.columnWidth = 12;
index.getRange("B1").format.columnWidth = 26;
index.getRange("C1").format.columnWidth = 38;
index.getRange("D1").format.columnWidth = 46;
index.tabColor = "#1F4E78";

episodes.forEach((ep, i) => { makeTrueFalseSheet(wb, ep, i * 2 + 1); makeChoiceSheet(wb, ep, i * 2 + 2); });
await fs.mkdir(outputDir, { recursive: true });
const file = await SpreadsheetFile.exportXlsx(wb);
await file.save(`${outputDir}/materiais_forms_15_roteiros.xlsx`);
console.log(`Created ${episodes.length} scripts and ${episodes.length * 2} exercise tabs: ${outputDir}/materiais_forms_15_roteiros.xlsx`);
