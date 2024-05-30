pipeline {
    agent any

    stages {
        stage('Build And Test') {
            steps {
                container('node') {
                    sh 'npm ci'
                    sh 'npm run build'
                }
            }
        }
    }
}
