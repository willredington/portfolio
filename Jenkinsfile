pipeline {
    agent any

    stages {
        // stage('Build And Test') {
        //     steps {
        //         container('node') {
        //             sh 'npm ci'
        //             sh 'npm run build'
        //         }
        //     }
        // }

        stage('Docker Build and Push') {
            steps {
                container('jnlp') {
                    sh 'ls'
                    sh 'aws ecr get-login-password --region us-east-2 | docker login --username AWS --password-stdin 992256429851.dkr.ecr.us-east-2.amazonaws.com'
                    sh 'docker build -t demo .'
                    sh 'docker tag demo:latest 992256429851.dkr.ecr.us-east-2.amazonaws.com/demo:latest'
                    sh 'docker push 992256429851.dkr.ecr.us-east-2.amazonaws.com/demo:latest'
                }
            }
        }
    }
}
