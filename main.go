package main

import (
	"context" // Pacote para gerenciar contextos de requisição
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"     // Importado para ler variáveis de ambiente
	"time"

	"github.com/gorilla/mux" // Importa o pacote Gorilla Mux para roteamento
	"github.com/rs/cors"     // Importa o pacote CORS
	"go.mongodb.org/mongo-driver/bson" // Pacote para trabalhar com BSON (formato de dados do MongoDB)
	"go.mongodb.org/mongo-driver/bson/primitive" // Tipos primitivos do BSON, como ObjectID
	"go.mongodb.org/mongo-driver/mongo" // Driver oficial do MongoDB
	"go.mongodb.org/mongo-driver/mongo/options" // Opções para o cliente MongoDB
)

// Evento representa a estrutura de um evento
type Evento struct {
	// OID é o ID único do MongoDB, usando omitempty para não incluir no JSON se estiver vazio
	ID              primitive.ObjectID `json:"id,omitempty" bson:"_id,omitempty"`
	Nome            string             `json:"nome"`
	Descricao       string             `json:"descricao"`
	Data            time.Time          `json:"data"`
	Endereco        string             `json:"endereco"`
	BackgroundColor string             `json:"background_color"` // Nova cor de fundo da credencial
	TextColor       string             `json:"text_color"`       // Nova cor do texto da credencial
}

// Participante representa a estrutura de um participante
type Participante struct {
	ID                  primitive.ObjectID   `json:"id,omitempty" bson:"_id,omitempty"`
	Nome                string               `json:"nome"`
	Email               string               `json:"email"`
	Empresa             string               `json:"empresa,omitempty" bson:"empresa,omitempty"` // Nova empresa do participante
	ProfilePictureBase64 string             `json:"profile_picture_base64,omitempty" bson:"profile_picture_base64,omitempty"` // Nova foto de perfil em Base64
	EventosParticipados []primitive.ObjectID `json:"eventos_participados" bson:"eventos_participados"`
}

var (
	mongoClient         *mongo.Client      // Cliente MongoDB global
	eventosCollection   *mongo.Collection // Coleção de eventos no MongoDB
	participantesCollection *mongo.Collection // Nova coleção de participantes no MongoDB
)

// connectDB estabelece a conexão com o banco de dados MongoDB
func connectDB() {
	// Obtém a URI do MongoDB da variável de ambiente, com um fallback para localhost
	mongoURI := os.Getenv("MONGO_URI")
	if mongoURI == "" {
		mongoURI = "mongodb://localhost:27017" // Fallback para desenvolvimento local sem Docker Compose
	}

	clientOptions := options.Client().ApplyURI(mongoURI) // URI de conexão do MongoDB
	var err error
	mongoClient, err = mongo.Connect(context.TODO(), clientOptions) // Conecta ao MongoDB
	if err != nil {
		log.Fatal(err) // Em caso de erro na conexão, encerra a aplicação
	}

	// Verifica a conexão com o banco de dados
	err = mongoClient.Ping(context.TODO(), nil)
	if err != nil {
		log.Fatal(err) // Em caso de erro no ping, encerra a aplicação
	}

	fmt.Println("Conectado ao MongoDB!")

	// Obtém as coleções 'eventos' e 'participantes' do banco de dados 'eventodb'
	eventosCollection = mongoClient.Database("eventodb").Collection("eventos")
	participantesCollection = mongoClient.Database("eventodb").Collection("participantes")
}

// getEventosHandler lida com a requisição GET para listar todos os eventos
func getEventosHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json") // Define o cabeçalho Content-Type como JSON

	var eventos []Evento // Slice para armazenar os eventos encontrados

	// Encontra todos os documentos na coleção 'eventos'
	cursor, err := eventosCollection.Find(context.TODO(), bson.M{})
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError) // Retorna erro interno do servidor
		return
	}
	defer cursor.Close(context.TODO()) // Garante que o cursor seja fechado

	// Itera sobre os resultados do cursor e decodifica cada documento para a struct Evento
	for cursor.Next(context.TODO()) {
		var evento Evento
		err := cursor.Decode(&evento)
		if err != nil {
			log.Printf("Erro ao decodificar evento: %v", err) // Loga o erro
			continue // Continua para o próximo documento
		}
		eventos = append(eventos, evento) // Adiciona o evento ao slice
	}

	if err := cursor.Err(); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(eventos) // Codifica o slice de eventos para JSON e envia a resposta
}

// getEventoHandler lida com a requisição GET para obter um evento por ID
func getEventoHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	vars := mux.Vars(r) // Obtém as variáveis da URL (neste caso, o ID)
	idParam := vars["id"]

	// Converte a string do ID para um ObjectID do MongoDB
	objID, err := primitive.ObjectIDFromHex(idParam)
	if err != nil {
		http.Error(w, "ID de evento inválido", http.StatusBadRequest) // Retorna erro se o ID for inválido
		return
	}

	var evento Evento
	// Encontra um único documento pelo seu _id
	err = eventosCollection.FindOne(context.TODO(), bson.M{"_id": objID}).Decode(&evento)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			http.Error(w, "Evento não encontrado", http.StatusNotFound) // Retorna erro se o evento não for encontrado
		} else {
			http.Error(w, err.Error(), http.StatusInternalServerError)
		}
		return
	}

	json.NewEncoder(w).Encode(evento) // Encontra o evento e o envia como JSON
}

// createEventoHandler lida com a requisição POST para criar um novo evento
func createEventoHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	var novoEvento Evento
	// Decodifica o corpo da requisição JSON para a struct Evento
	err := json.NewDecoder(r.Body).Decode(&novoEvento)
	if err != nil {
		http.Error(w, "Requisição inválida", http.StatusBadRequest) // Retorna erro se o JSON for inválido
		return
	}

	// Insere o novo evento na coleção
	result, err := eventosCollection.InsertOne(context.TODO(), novoEvento)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Atribui o ID gerado pelo MongoDB ao evento
	oid, ok := result.InsertedID.(primitive.ObjectID)
	if !ok {
		http.Error(w, "Erro ao obter ID inserido", http.StatusInternalServerError)
		return
	}
	novoEvento.ID = oid

	w.WriteHeader(http.StatusCreated) // Define o status HTTP como 201 Created
	json.NewEncoder(w).Encode(novoEvento) // Envia o evento criado como JSON
}

// updateEventoHandler lida com a requisição PUT para atualizar um evento existente
func updateEventoHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	vars := mux.Vars(r)
	idParam := vars["id"]

	// Converte a string do ID para um ObjectID do MongoDB
	objID, err := primitive.ObjectIDFromHex(idParam)
	if err != nil {
		http.Error(w, "ID de evento inválido", http.StatusBadRequest)
		return
	}

	var eventoAtualizado Evento
	err = json.NewDecoder(r.Body).Decode(&eventoAtualizado)
	if err != nil {
		http.Error(w, "Requisição inválida", http.StatusBadRequest)
		return
	}

	// Cria um documento BSON para as atualizações
	update := bson.M{
		"$set": bson.M{
			"nome":            eventoAtualizado.Nome,
			"descricao":       eventoAtualizado.Descricao,
			"data":            eventoAtualizado.Data,
			"endereco":        eventoAtualizado.Endereco,
			"background_color": eventoAtualizado.BackgroundColor, // Atualiza a cor de fundo
			"text_color":      eventoAtualizado.TextColor,       // Atualiza a cor do texto
		},
	}

	// Atualiza um único documento pelo seu _id
	result, err := eventosCollection.UpdateOne(context.TODO(), bson.M{"_id": objID}, update)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if result.MatchedCount == 0 {
		http.Error(w, "Evento não encontrado", http.StatusNotFound) // Retorna erro se o evento não for encontrado
		return
	}

	// Opcional: Buscar o documento atualizado para retornar a versão mais recente
	err = eventosCollection.FindOne(context.TODO(), bson.M{"_id": objID}).Decode(&eventoAtualizado)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(eventoAtualizado) // Envia o evento atualizado como JSON
}

// deleteEventoHandler lida com a requisição DELETE para deletar um evento
func deleteEventoHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	vars := mux.Vars(r)
	idParam := vars["id"]

	// Converte a string do ID para um ObjectID do MongoDB
	objID, err := primitive.ObjectIDFromHex(idParam)
	if err != nil {
		http.Error(w, "ID de evento inválido", http.StatusBadRequest)
		return
	}

	// Deleta um único documento pelo seu _id
	result, err := eventosCollection.DeleteOne(context.TODO(), bson.M{"_id": objID})
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if result.DeletedCount == 0 {
		http.Error(w, "Evento não encontrado", http.StatusNotFound) // Retorna erro se o evento não for encontrado
		return
	}

	w.WriteHeader(http.StatusNoContent) // Retorna status 204 No Content para indicar sucesso sem conteúdo
}

// createParticipanteHandler lida com a requisição POST para cadastrar um participante
// e vinculá-lo automaticamente ao último evento criado.
func createParticipanteHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	var novoParticipante Participante
	err := json.NewDecoder(r.Body).Decode(&novoParticipante)
	if err != nil {
		http.Error(w, "Requisição inválida", http.StatusBadRequest)
		return
	}

	// 1. Encontrar o último evento criado
	var latestEvent Evento
	// Ordena por _id em ordem decrescente para pegar o mais recente
	err = eventosCollection.FindOne(context.TODO(), bson.M{}, options.FindOne().SetSort(bson.D{{Key: "_id", Value: -1}})).Decode(&latestEvent)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			http.Error(w, "Nenhum evento encontrado para vincular o participante. Crie um evento primeiro.", http.StatusNotFound)
		} else {
			http.Error(w, err.Error(), http.StatusInternalServerError)
		}
		return
	}
	eventObjID := latestEvent.ID // ID do último evento criado

	// 2. Tentar encontrar um participante existente pelo email
	var existingParticipante Participante
	err = participantesCollection.FindOne(context.TODO(), bson.M{"email": novoParticipante.Email}).Decode(&existingParticipante)

	if err == nil {
		// Participante já existe, atualiza a lista de eventos participados
		found := false
		for _, id := range existingParticipante.EventosParticipados {
			if id == eventObjID {
				found = true
				break
			}
		}
		if !found { // Se o evento ainda não estiver na lista, adiciona
			existingParticipante.EventosParticipados = append(existingParticipante.EventosParticipados, eventObjID)
			update := bson.M{"$set": bson.M{"eventos_participados": existingParticipante.EventosParticipados}}
			_, err := participantesCollection.UpdateOne(context.TODO(), bson.M{"_id": existingParticipante.ID}, update)
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
		}
		// Atualiza a foto de perfil e empresa se fornecidas
		updateFields := bson.M{}
		if novoParticipante.ProfilePictureBase64 != "" {
			updateFields["profile_picture_base64"] = novoParticipante.ProfilePictureBase64
		}
		if novoParticipante.Empresa != "" {
			updateFields["empresa"] = novoParticipante.Empresa
		}

		if len(updateFields) > 0 {
			_, err := participantesCollection.UpdateOne(context.TODO(), bson.M{"_id": existingParticipante.ID}, bson.M{"$set": updateFields})
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			// Atualiza a struct local para a resposta
			if val, ok := updateFields["profile_picture_base64"]; ok {
				existingParticipante.ProfilePictureBase64 = val.(string)
			}
			if val, ok := updateFields["empresa"]; ok {
				existingParticipante.Empresa = val.(string)
			}
		}

		json.NewEncoder(w).Encode(existingParticipante) // Retorna o participante atualizado
		return
	} else if err == mongo.ErrNoDocuments {
		// Participante não existe, cria um novo
		novoParticipante.EventosParticipados = []primitive.ObjectID{eventObjID} // Vincula ao evento atual
		result, err := participantesCollection.InsertOne(context.TODO(), novoParticipante)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		oid, ok := result.InsertedID.(primitive.ObjectID)
		if !ok {
			http.Error(w, "Erro ao obter ID inserido para participante", http.StatusInternalServerError)
			return
		}
		novoParticipante.ID = oid
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(novoParticipante) // Retorna o novo participante
		return
	} else {
		// Outro erro do MongoDB
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
}

// getParticipantesByEventHandler lida com a requisição GET para listar participantes de um evento
func getParticipantesByEventHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	vars := mux.Vars(r)
	eventIdParam := vars["eventId"]

	eventObjID, err := primitive.ObjectIDFromHex(eventIdParam)
	if err != nil {
		http.Error(w, "ID de evento inválido", http.StatusBadRequest)
		return
	}

	var participantes []Participante
	// Encontra participantes que tenham o ID do evento na sua lista de eventos participados
	cursor, err := participantesCollection.Find(context.TODO(), bson.M{"eventos_participados": eventObjID})
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer cursor.Close(context.TODO())

	for cursor.Next(context.TODO()) {
		var participante Participante
		err := cursor.Decode(&participante)
		if err != nil {
			log.Printf("Erro ao decodificar participante: %v", err)
			continue
		}
		participantes = append(participantes, participante)
	}

	if err := cursor.Err(); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(participantes)
}

// getParticipanteHandler lida com a requisição GET para obter um participante por ID
func getParticipanteHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	vars := mux.Vars(r)
	idParam := vars["id"]

	objID, err := primitive.ObjectIDFromHex(idParam)
	if err != nil {
		http.Error(w, "ID de participante inválido", http.StatusBadRequest)
		return
	}

	var participante Participante
	err = participantesCollection.FindOne(context.TODO(), bson.M{"_id": objID}).Decode(&participante)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			http.Error(w, "Participante não encontrado", http.StatusNotFound)
		} else {
			http.Error(w, err.Error(), http.StatusInternalServerError)
		}
		return
	}

	json.NewEncoder(w).Encode(participante)
}

// updateParticipanteHandler lida com a requisição PUT para atualizar um participante existente
func updateParticipanteHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	vars := mux.Vars(r)
	idParam := vars["id"]

	objID, err := primitive.ObjectIDFromHex(idParam)
	if err != nil {
		http.Error(w, "ID de participante inválido", http.StatusBadRequest)
		return
	}

	var participanteAtualizado Participante
	err = json.NewDecoder(r.Body).Decode(&participanteAtualizado)
	if err != nil {
		http.Error(w, "Requisição inválida", http.StatusBadRequest)
		return
	}

	// Cria um documento BSON para as atualizações
	update := bson.M{
		"$set": bson.M{
			"nome":  participanteAtualizado.Nome,
			"email": participanteAtualizado.Email,
			"profile_picture_base64": participanteAtualizado.ProfilePictureBase64, // Atualiza a foto de perfil
			"empresa": participanteAtualizado.Empresa, // Atualiza a empresa
			// Não atualizamos eventos_participados diretamente por aqui,
			// pois a lógica de vinculação é no createParticipanteHandler
		},
	}

	result, err := participantesCollection.UpdateOne(context.TODO(), bson.M{"_id": objID}, update)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if result.MatchedCount == 0 {
		http.Error(w, "Participante não encontrado", http.StatusNotFound)
		return
	}

	err = participantesCollection.FindOne(context.TODO(), bson.M{"_id": objID}).Decode(&participanteAtualizado)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(participanteAtualizado)
}

// deleteParticipanteHandler lida com a requisição DELETE para deletar um participante
func deleteParticipanteHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	vars := mux.Vars(r)
	idParam := vars["id"]

	objID, err := primitive.ObjectIDFromHex(idParam)
	if err != nil {
		http.Error(w, "ID de participante inválido", http.StatusBadRequest)
		return
	}

	result, err := participantesCollection.DeleteOne(context.TODO(), bson.M{"_id": objID})
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if result.DeletedCount == 0 {
		http.Error(w, "Participante não encontrado", http.StatusNotFound)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func main() {
	// Conecta ao MongoDB antes de iniciar o servidor HTTP
	connectDB()
	// Garante que a conexão com o MongoDB seja fechada ao sair da função main
	defer func() {
		if err := mongoClient.Disconnect(context.TODO()); err != nil {
			log.Fatal(err)
		}
		fmt.Println("Conexão com MongoDB fechada.")
	}()

	router := mux.NewRouter() // Cria um novo roteador Gorilla Mux

	// Rotas para Eventos
	router.HandleFunc("/events", getEventosHandler).Methods("GET")
	router.HandleFunc("/events/{id}", getEventoHandler).Methods("GET")
	router.HandleFunc("/events", createEventoHandler).Methods("POST")
	router.HandleFunc("/events/{id}", updateEventoHandler).Methods("PUT")
	router.HandleFunc("/events/{id}", deleteEventoHandler).Methods("DELETE")

	// Novas Rotas para Participantes
	router.HandleFunc("/participants", createParticipanteHandler).Methods("POST")
	router.HandleFunc("/events/{eventId}/participants", getParticipantesByEventHandler).Methods("GET") // Esta rota ainda precisa do eventId
	router.HandleFunc("/participants/{id}", getParticipanteHandler).Methods("GET")
	router.HandleFunc("/participants/{id}", updateParticipanteHandler).Methods("PUT")
	router.HandleFunc("/participants/{id}", deleteParticipanteHandler).Methods("DELETE")

	fmt.Println("Servidor iniciado na porta :8080")

	// Configuração do CORS
	// Permite todas as origens, todos os métodos e todos os cabeçalhos.
	// Em um ambiente de produção, você deve restringir as origens permitidas.
	c := cors.New(cors.Options{
		AllowedOrigins: []string{"*"}, // Permite todas as origens
		AllowedMethods: []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"}, // Métodos permitidos
		AllowedHeaders: []string{"Content-Type", "Authorization"}, // Cabeçalhos permitidos
		ExposedHeaders: []string{"Content-Length"}, // Cabeçalhos expostos
		AllowCredentials: true, // Permite credenciais (cookies, cabeçalhos de autorização)
		MaxAge: 300, // Tempo máximo em segundos que os resultados de um preflight request podem ser armazenados em cache
	})

	// Envolve o roteador com o handler CORS
	handler := c.Handler(router)

	// Inicia o servidor HTTP na porta 8080 com o handler CORS
	log.Fatal(http.ListenAndServe(":8080", handler)) // Loga qualquer erro fatal ao iniciar o servidor
}

