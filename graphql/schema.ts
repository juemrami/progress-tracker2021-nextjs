import { gql } from "apollo-server-micro";

export const typeDefs = gql`
  type Query {
    hello: String!
    getAllUsers(last: Int): [User!]!
    grabSingleUser(name: String, email: String, id: ID): User!
    allExercises(last: Int): [Exercise]
    user(name: String, email: String, id: ID!): User
  }

  type Mutation {

    createUser(name: String!, email: String!): User!
    addEmptyWorkout(ownerID: ID!): [Workout]
    createWorkout(ownerID: ID!): User
    }
  type User {
    id: ID!
    name: String!
    email: String!
    exerciseHistory: [Workout!]
  }
  type Workout {
    ownerID: ID
    owner: User
    date: String!
    sets: [Set]
  }
  type Set {
    exerciseID: ID!
    ownerID: ID!
    reps: Int!
    rpe: Int!
  }
  type Exercise {
    id: Int
    uuid:ID!
    name: String!
    url: String
    inSets: [Set]
  }
`;

// {
//     getAllExercisesLogged{
//      allUsers{
//         name
//             email
//                 exerciseHistory{
//                     sets{
//                         exercise
//             }
//         }
//      }
//     }
//   }