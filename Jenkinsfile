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
                    sh 'ls -a /var/run/docker.sock'
                    sh 'docker version'
                }
            }
        }
    }
}
